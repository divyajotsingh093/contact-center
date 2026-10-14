/** Synthetic source material for the four demo channels (BSD 3.1.1). */
export interface Sample {
  key: string;
  label: string;
  source: "email" | "call_centre" | "letter" | "social" | "web_form";
  subject?: string;
  sender?: string;
  fileName?: string;
  mimeType?: string;
  text: string;
}

export const SAMPLES: Sample[] = [
  {
    key: "email-significant",
    label: "Shared-inbox email: claim delay (significant)",
    source: "email",
    subject: "Unacceptable delay on my claim",
    sender: "Tan Mei Ling <meiling.tan@example.com>",
    fileName: "hospital_invoice.pdf",
    mimeType: "application/pdf",
    text: `Dear Income,

My claim no CL1234567 under policy LF12345678 has been pending for 3 months. I have had to pay $12,000 in hospital bills out of pocket and my family is under financial difficulty.

My agent AG1234 never replied to my messages. I want my claim paid this week, or I will write to MAS and the Straits Times.

Regards,
Tan Mei Ling`,
  },
  {
    key: "call-vulnerable",
    label: "Call-centre audio: elderly customer (transcript)",
    source: "call_centre",
    fileName: "call_20261019_0932.wav",
    mimeType: "audio/wav",
    text: `[Transcript, call centre, 19 Oct 2026 09:32]
Agent: Good morning, Income, how can I help?
Caller: My name is Lim Ah Huat. I am 82 years old. My hospital claim for my knee surgery, policy HS20001111, I don't understand the letter you sent. It says something about co-payment. I already paid so much.
Agent: I'm sorry to hear that, Mr Lim.
Caller: I am very unhappy. Nobody explained to me. I want someone to explain properly and refund what I overpaid. My phone is 98765432.`,
  },
  {
    key: "letter-enquiry",
    label: "Scanned letter: enquiry (OCR text)",
    source: "letter",
    fileName: "letter_scan_0412.pdf",
    mimeType: "application/pdf",
    text: `[OCR text]
12 October 2026

Income Insurance Limited
Customer Service

Dear Sir/Madam,

Could you advise how I can update the nominee on my policy LF40003333? I recently got married and would like to add my wife. What is the process and which forms do I need?

Thank you.
Yours faithfully,
Muhammad Faizal
faizal.m@example.com`,
  },
  {
    key: "social-feedback",
    label: "Social screenshot: feedback (OCR text)",
    source: "social",
    fileName: "facebook_post_screenshot.png",
    mimeType: "image/png",
    text: `[OCR text from screenshot of a public Facebook post]
Siew Ling Ng · 2h
Just want to give feedback to @Income – your claims hotline staff Ms Wong was very patient with my mum yesterday. Great service! Would be nice if the app showed claim status though. My email siewling.ng@example.com if you want to follow up.`,
  },
  {
    key: "email-appeal",
    label: "Shared-inbox email: appeal",
    source: "email",
    subject: "Appeal – rejected motor claim",
    sender: "Rachel Chen <rachel.chen@example.com>",
    text: `Hello,

I would like to appeal the decision to reject my car accident claim under policy MT30002222. The workshop report shows the damage was from the accident on 2 October, not wear and tear. Please reconsider.

Thanks,
Rachel Chen`,
  },
];
