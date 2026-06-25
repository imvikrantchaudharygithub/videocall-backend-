import { Request, Response } from 'express';
import { successResponse } from '../types';

export const getPrivacyPolicy = async (req: Request, res: Response): Promise<void> => {
  res.json(successResponse({
    title: 'Privacy Policy',
    lastUpdated: '2026-03-23',
    content: `Privacy Policy for CompanionCall

Last Updated: March 23, 2026

1. Introduction

CompanionCall ("we", "our", "us") operates a video and voice calling platform that connects callers with hosts for real-time communication. This Privacy Policy explains how we collect, use, disclose, and safeguard your personal information when you use our mobile application and related services (collectively, the "Service"). By using the Service, you consent to the practices described in this policy.

2. Information We Collect

We collect the following categories of personal data:

a) Account Information: Phone number (optional for guest users), display name, profile photo, date of birth (for age verification), and account credentials.

b) Transaction Information: Coin purchase history, payment details (processed securely via our payment partner), gift transactions, and earning records for hosts.

c) Call History: Records of calls made or received, call duration, call type (audio/video), and associated metadata.

d) Device Information: Device model, operating system version, unique device identifiers, push notification tokens (FCM tokens), and app version.

e) Network Information: IP address, connection type, and general location data derived from your IP address.

f) Usage Data: App interaction patterns, feature usage statistics, and session data.

3. How We Use Your Information

We use the information we collect for the following purposes:

a) Service Delivery: To provide, maintain, and improve the calling platform, process transactions, and facilitate communication between callers and hosts.

b) Billing and Payments: To process coin purchases, manage wallet balances, calculate host earnings, and handle withdrawal requests.

c) Customer Support: To respond to your inquiries, resolve disputes, and provide technical assistance.

d) Fraud Prevention and Safety: To detect and prevent fraudulent activity, enforce our Terms of Service, verify user age, and maintain platform safety through content moderation.

e) Communications: To send transactional notifications such as OTP codes, payment confirmations, and call alerts via push notifications or SMS.

4. Data Sharing

We do not sell your personal data to third parties. We share your information only with the following service providers who assist us in operating the platform:

a) Razorpay: Our payment processing partner, which handles all financial transactions securely. Your payment information is subject to Razorpay's privacy policy.

b) Agora: Our real-time communication provider, which facilitates video and voice calls. Call stream data is processed through Agora's infrastructure.

c) Twilio: Our SMS service provider, used to deliver OTP codes and transactional messages to your phone number.

d) Cloudinary: Our media storage provider, used to store and serve profile photos and other uploaded images.

e) Firebase (Google): Used for push notification delivery via Firebase Cloud Messaging (FCM).

We may also disclose your information if required by law, court order, or governmental authority, or to protect our rights and safety or the rights and safety of others.

5. Data Retention

We retain your account data for as long as your account remains active. If you request account deletion, we will delete your personal data within 30 days of the request, except where we are required by law to retain certain records (such as transaction records for tax or regulatory compliance). Anonymized and aggregated data that cannot identify you may be retained indefinitely for analytics purposes.

6. Data Security

We implement appropriate technical and organizational measures to protect your personal data, including:

a) Encryption in transit using HTTPS/TLS for all data transmitted between your device and our servers.

b) Hashed passwords and secure session management.

c) Secure payment processing through PCI-DSS compliant payment partners.

d) Access controls limiting employee access to personal data on a need-to-know basis.

While we strive to protect your information, no method of electronic transmission or storage is completely secure. We cannot guarantee absolute security.

7. Your Rights

You have the following rights regarding your personal data:

a) Access: You may request a copy of the personal data we hold about you.

b) Correction: You may request correction of any inaccurate or incomplete personal data.

c) Deletion: You may request deletion of your personal data, subject to legal retention requirements.

d) Portability: You may request your data in a structured, machine-readable format.

To exercise any of these rights, please contact us at support@companioncall.com.

8. Children's Privacy

CompanionCall is intended for users who are 18 years of age or older. We do not knowingly collect personal information from individuals under 18. If we become aware that we have collected data from a person under 18, we will take steps to delete such information promptly. If you believe a minor has provided us with personal data, please contact us at support@companioncall.com.

9. Cookies and Similar Technologies

We use minimal cookies and similar technologies solely for session management and authentication purposes. We do not use tracking cookies for advertising or cross-site tracking.

10. Compliance with the Digital Personal Data Protection Act, 2023

We are committed to compliance with the Digital Personal Data Protection (DPDP) Act, 2023 of India. As a Data Fiduciary under the Act, we process your personal data lawfully and transparently for legitimate purposes. You have the right to access, correct, and erase your personal data, as well as the right to nominate another person to exercise your rights. We implement reasonable security safeguards to protect your data and will notify you and the relevant Data Protection Board in the event of a personal data breach. If you have concerns about our data practices, you may file a complaint with the Data Protection Board of India.

11. Changes to This Privacy Policy

We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the updated policy within the app and updating the "Last Updated" date. Your continued use of the Service after such changes constitutes your acceptance of the revised policy.

12. Contact Us

If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us at:

Email: support@companioncall.com`
  }));
};

export const getTermsOfService = async (req: Request, res: Response): Promise<void> => {
  res.json(successResponse({
    title: 'Terms of Service',
    lastUpdated: '2026-03-23',
    content: `Terms of Service for CompanionCall

Last Updated: March 23, 2026

Please read these Terms of Service ("Terms") carefully before using the CompanionCall application and related services (the "Service"). By accessing or using the Service, you agree to be bound by these Terms.

1. Eligibility

You must be at least 18 years of age to use CompanionCall. By creating an account or using the Service, you represent and warrant that you are at least 18 years old. We reserve the right to request age verification at any time and to terminate accounts of users who are found to be under 18.

2. Account Registration and Security

a) Each person may create only one account on CompanionCall. Creating multiple accounts may result in all associated accounts being banned.

b) You are responsible for maintaining the confidentiality of your account credentials, including your session tokens and OTP codes. You are responsible for all activities that occur under your account.

c) You agree to notify us immediately at support@companioncall.com if you suspect unauthorized access to your account.

3. Virtual Currency (Coins)

a) CompanionCall uses a virtual currency system called "coins." Coins can be purchased with real money through the in-app payment system.

b) Coins have no real-world monetary value outside of the CompanionCall platform. They cannot be exchanged for cash, transferred to other users outside of the designated gifting feature, or redeemed outside of the platform.

c) All coin purchases are final and non-refundable, except as required by applicable law.

d) CompanionCall reserves the right to modify coin pricing, adjust coin pack offerings, and change the coin exchange rates at any time without prior notice.

e) Unused coins remain in your account as long as your account is active. Coins may be forfeited if your account is terminated for violation of these Terms.

4. User Conduct

By using CompanionCall, you agree to the following rules of conduct:

a) No Harassment: You shall not harass, threaten, intimidate, stalk, or bully any other user. This includes verbal abuse, discriminatory language, and persistent unwanted contact.

b) No Nudity or Sexual Content: You shall not display, share, or request nudity, sexually explicit content, or engage in sexual conduct during calls. Violation of this rule will result in immediate account termination.

c) No Sharing of Personal Contact Information: You shall not share or solicit personal contact information, including phone numbers, email addresses, social media handles, or messaging app usernames during calls or through the chat feature. The platform automatically filters such content to protect user privacy.

d) No Recording: You shall not record, screenshot, or capture any audio, video, or content from calls without the explicit consent of all parties involved. Unauthorized recording may violate applicable laws and will result in account termination.

e) No Illegal Activity: You shall not use the Service for any illegal purpose, including but not limited to fraud, money laundering, or solicitation of illegal services.

f) No Impersonation: You shall not impersonate any person or entity, or falsely represent your identity or affiliation.

5. Host Terms

a) Hosts on CompanionCall are independent contractors and not employees, agents, or representatives of CompanionCall. Nothing in these Terms creates an employment relationship.

b) The platform retains a 70% commission on all earnings generated by hosts through calls and gifts. The remaining 30% is credited to the host's earnings balance and may be withdrawn subject to minimum withdrawal thresholds and processing times.

c) Hosts are responsible for their own tax obligations arising from earnings on the platform.

d) Hosts must comply with all applicable laws and regulations in their jurisdiction.

e) CompanionCall reserves the right to modify commission rates with reasonable advance notice to hosts.

6. Payments

a) All payments on CompanionCall are processed through Razorpay, our authorized payment gateway. By making a purchase, you also agree to Razorpay's terms of service and privacy policy.

b) You agree to provide accurate and complete payment information. CompanionCall is not responsible for failed transactions due to incorrect payment details.

c) Prices are displayed in Indian Rupees (INR) unless otherwise specified.

7. Refund Policy

a) All coin purchases are non-refundable except as required by applicable consumer protection laws.

b) In cases of unauthorized transactions or technical errors resulting in incorrect charges, please contact support@companioncall.com within 7 days of the transaction. We will investigate and process refunds where appropriate.

c) Refunds, if approved, will be processed to the original payment method within 7-10 business days.

8. Content Moderation

a) CompanionCall reserves the right to monitor, review, and moderate user activity on the platform to ensure compliance with these Terms.

b) We may, at our sole discretion, suspend or permanently ban accounts that violate these Terms, without prior notice and without liability.

c) Users may report violations by other users through the in-app reporting feature. We will review all reports and take appropriate action.

9. Limitation of Liability

a) The Service is provided on an "as is" and "as available" basis without warranties of any kind, whether express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, and non-infringement.

b) To the maximum extent permitted by applicable law, CompanionCall and its officers, directors, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, or goodwill, arising out of or in connection with your use of the Service.

c) Our total liability for any claims arising under these Terms shall not exceed the amount you have paid to CompanionCall in the 12 months preceding the claim.

d) CompanionCall is not responsible for the conduct of any user, whether online or offline. We do not guarantee the quality, safety, or legality of calls or interactions between users.

10. Intellectual Property

All content, trademarks, logos, and intellectual property displayed on CompanionCall are the property of CompanionCall or its licensors. You may not copy, modify, distribute, or create derivative works without our prior written consent.

11. Termination

a) You may terminate your account at any time by contacting support@companioncall.com or using the account deletion feature in the app.

b) We may suspend or terminate your account at any time for violation of these Terms, fraudulent activity, or any other reason at our discretion.

c) Upon termination, your right to use the Service ceases immediately. Any remaining coins in your account will be forfeited.

12. Governing Law and Jurisdiction

These Terms shall be governed by and construed in accordance with the laws of India. Any disputes arising out of or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts in Bengaluru, Karnataka, India.

13. Changes to Terms

We reserve the right to modify these Terms at any time. We will notify users of material changes by posting the updated Terms within the app and updating the "Last Updated" date. Your continued use of the Service after such changes constitutes your acceptance of the revised Terms. If you do not agree with the updated Terms, you must stop using the Service.

14. Severability

If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary, and the remaining provisions shall remain in full force and effect.

15. Contact Us

If you have any questions about these Terms of Service, please contact us at:

Email: support@companioncall.com`
  }));
};
