// End-to-end call flow test: simulates the caller app and host app
// (REST + Socket.io exactly as the apps do it). Run after seedTestCall.ts:
//   node test-call-flow.js '<seed-json>'
const { io } = require('../caller-app/node_modules/socket.io-client');

const PORT = process.env.PORT || 3000;
const BASE = `http://localhost:${PORT}/api`;
const SOCKET = `http://localhost:${PORT}`;
const seed = JSON.parse(process.argv[2]);

const api = (token) => async (method, path, body) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
};
const callerApi = api(seed.callerToken);
const hostApi = api(seed.hostToken);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const waitFor = (events, name, timeoutMs = 8000) => new Promise((resolve, reject) => {
  const t0 = Date.now();
  const iv = setInterval(() => {
    const hit = events.find(e => e.event === name && !e.consumed);
    if (hit) { hit.consumed = true; clearInterval(iv); resolve(hit.data); }
    else if (Date.now() - t0 > timeoutMs) { clearInterval(iv); reject(new Error(`timeout waiting for ${name}`)); }
  }, 100);
});

const connectSocket = (token, label, events) => new Promise((resolve, reject) => {
  const s = io(SOCKET, { auth: { token }, transports: ['websocket'] });
  s.onAny((event, data) => {
    events.push({ event, data });
    console.log(`   [${label} socket] ${event}: ${JSON.stringify(data)}`);
  });
  s.on('connect', () => resolve(s));
  s.on('connect_error', (e) => reject(new Error(`${label} socket: ${e.message}`)));
});

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
};

(async () => {
  const callerEvents = [], hostEvents = [];
  console.log('— Connecting caller & host sockets (JWT handshake)…');
  const callerSock = await connectSocket(seed.callerToken, 'caller', callerEvents);
  const hostSock = await connectSocket(seed.hostToken, 'host', hostEvents);
  check('Both sockets connected', true);

  // ── Happy path: initiate → incoming → accept → ticks → end ──
  console.log('\n— STEP 1: Caller initiates video call (REST /calls/initiate)');
  const init = await callerApi('POST', '/calls/initiate', { hostId: seed.hostId, callType: 'video' });
  check('initiate returns 200 success', init.status === 200 && init.body.success, JSON.stringify(init.body).slice(0, 200));
  const { callId, agoraToken, channelName } = init.body.data || {};
  check('initiate returns channelName (caller app reads this key)', !!channelName, channelName);
  check('initiate returns agoraToken', typeof agoraToken === 'string' && agoraToken.length > 50, `len=${agoraToken?.length}`);

  console.log('\n— STEP 2: Host should receive call:incoming push');
  const incoming = await waitFor(hostEvents, 'call:incoming');
  check('host got call:incoming with matching callId', incoming.callId === callId);
  check('call:incoming has callerName (host app UI shows this)', incoming.callerName === 'Test Caller', incoming.callerName);
  check('call:incoming has callType', incoming.callType === 'video');

  console.log('\n— STEP 3: Host accepts (REST /calls/:id/accept)');
  const acc = await hostApi('POST', `/calls/${callId}/accept`);
  check('accept returns 200 success', acc.status === 200 && acc.body.success, JSON.stringify(acc.body).slice(0, 160));
  check('accept returns agoraToken for host', typeof acc.body.data?.agoraToken === 'string' && acc.body.data.agoraToken.length > 50);
  check('accept returns channelName matching call', acc.body.data?.channelName === channelName, acc.body.data?.channelName);
  const connected = await waitFor(callerEvents, 'call:connected');
  check('caller got call:connected', connected.callId === callId);

  console.log('\n— STEP 4: Caller billing ticks (REST /calls/:id/tick, like the app every 5s)');
  const balBefore = (await callerApi('GET', '/wallet/balance')).body.data;
  const tick1 = await callerApi('POST', `/calls/${callId}/tick`);
  check('tick 1 returns remainingCoins', tick1.status === 200 && typeof tick1.body.data?.remainingCoins === 'number', JSON.stringify(tick1.body).slice(0, 120));
  const tick2 = await callerApi('POST', `/calls/${callId}/tick`);
  check('tick 2 deducts coins (decreasing)', tick2.body.data?.remainingCoins < tick1.body.data?.remainingCoins,
    `${tick1.body.data?.remainingCoins} → ${tick2.body.data?.remainingCoins}`);

  console.log('\n— STEP 5: Host ends call (REST /calls/:id/end)');
  await sleep(2000); // let the call run a moment
  const end = await hostApi('POST', `/calls/${callId}/end`);
  check('end returns 200 with billing summary', end.status === 200 && end.body.success, JSON.stringify(end.body).slice(0, 200));
  check('3-min minimum billing applied', end.body.data?.totalCostCoins >= 180, `totalCostCoins=${end.body.data?.totalCostCoins} (rate 60/min × 3 min = 180)`);
  const endedEvt = await waitFor(callerEvents, 'call:ended');
  check('caller got call:ended push', endedEvt.callId === callId, `endReason=${endedEvt.endReason}`);

  const balAfter = (await callerApi('GET', '/wallet/balance')).body.data;
  check('caller wallet debited exactly the billed total',
    balBefore.balanceCoins - balAfter.balanceCoins === end.body.data.totalCostCoins,
    `${balBefore.balanceCoins} → ${balAfter.balanceCoins} (billed ${end.body.data.totalCostCoins})`);
  const earnings = await hostApi('GET', '/earnings/summary');
  check('host earnings credited', earnings.body.data && JSON.stringify(earnings.body.data).includes(String(end.body.data.hostEarningsCoins)),
    JSON.stringify(earnings.body.data).slice(0, 200));

  // ── Probes ──
  console.log('\n— PROBE A: end the already-ended call again');
  const reEnd = await hostApi('POST', `/calls/${callId}/end`);
  check('🔍 double-end rejected with 400 CALL_NOT_ACTIVE', reEnd.status === 400, JSON.stringify(reEnd.body).slice(0, 120));

  console.log('\n— PROBE B: tick on ended call');
  const deadTick = await callerApi('POST', `/calls/${callId}/tick`);
  check('🔍 tick on dead call rejected with 400', deadTick.status === 400, JSON.stringify(deadTick.body).slice(0, 120));

  console.log('\n— PROBE C: decline flow via host app\'s /reject path');
  const init2 = await callerApi('POST', '/calls/initiate', { hostId: seed.hostId, callType: 'voice' });
  const callId2 = init2.body.data?.callId;
  await waitFor(hostEvents, 'call:incoming');
  const rej = await hostApi('POST', `/calls/${callId2}/reject`, { reason: 'busy' });
  check('🔍 /reject (host app path) returns 200', rej.status === 200, JSON.stringify(rej.body).slice(0, 120));
  const declinedEvt = await waitFor(callerEvents, 'call:ended');
  check('🔍 caller notified of decline via call:ended', declinedEvt.callId === callId2 && declinedEvt.endReason === 'declined', JSON.stringify(declinedEvt));

  console.log('\n— PROBE D: initiate to a nonexistent host');
  const badInit = await callerApi('POST', '/calls/initiate', { hostId: '64b000000000000000000000', callType: 'video' });
  check('🔍 bogus host rejected (HOST_OFFLINE)', badInit.status === 400 && badInit.body.error?.code === 'HOST_OFFLINE', JSON.stringify(badInit.body).slice(0, 120));

  console.log('\n— PROBE E: ring timeout (no answer for 30s)');
  const init3 = await callerApi('POST', '/calls/initiate', { hostId: seed.hostId, callType: 'video' });
  const callId3 = init3.body.data?.callId;
  await waitFor(hostEvents, 'call:incoming');
  console.log('   waiting 32s for server-side ring timeout…');
  const [noAnswer, cancelled] = await Promise.all([
    waitFor(callerEvents, 'call:no-answer', 35000),
    waitFor(hostEvents, 'call:cancelled', 35000),
  ]);
  check('🔍 caller got call:no-answer after 30s', noAnswer.callId === callId3);
  check('🔍 host got call:cancelled after 30s', cancelled.callId === callId3);

  console.log(`\n${failures === 0 ? '🎉 ALL CHECKS PASSED' : `💥 ${failures} CHECK(S) FAILED`}`);
  callerSock.close(); hostSock.close();
  process.exit(failures === 0 ? 0 : 1);
})().catch(err => { console.error('💥 HARNESS ERROR:', err.message); process.exit(2); });
