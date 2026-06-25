export const AI_MESSAGE_TEMPLATES = [
  "Hey handsome! I'm free right now... come say hi 😘",
  "I've been waiting for someone fun to talk to 💋",
  "Feeling lonely tonight... want to keep me company? 😏",
  "I just went online and thought of you 💫",
  "Don't be shy, I don't bite... much 😈",
  "Hey there! I'm in the mood to chat with someone special 💕",
  "Bored and looking for some fun... you up? 😘",
  "I saw you online and couldn't resist saying hi 💋",
  "Come talk to me, I promise I'll make it worth your time 😏",
  "Hey cutie! Want to have some fun tonight? 💫",
  "I'm all alone right now... keep me company? 😈",
  "Miss having someone to talk to... be my chat buddy? 💕",
  "Just thinking about our last chat and it made me smile 😘",
  "Hey! I'm feeling naughty tonight... come play 💋",
  "I've got some time just for you... interested? 😏",
  "You caught my eye! Let's get to know each other 💫",
  "Couldn't sleep... want to keep me up? 😈",
  "I'm feeling extra friendly tonight 😘 Say hi!",
  "Looking for someone to make my night better... is that you? 💋",
  "Hey gorgeous! I saved a spot just for you 😏",
  "Feeling playful tonight... care to join? 💫",
  "I'm online and waiting... don't leave me hanging 😈",
  "Something about you caught my attention 💕 Let's talk!",
  "Late night thoughts... and you popped into my head 😘",
  "I dare you to message me first 😏💋",
];

export const getRandomAIMessage = (): string => {
  return AI_MESSAGE_TEMPLATES[Math.floor(Math.random() * AI_MESSAGE_TEMPLATES.length)];
};
