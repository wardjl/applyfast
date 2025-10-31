import { HighScoringJobsEmail } from "../../../convex/emailTemplates";
import { render } from "@react-email/render";

export const dynamic = 'force-dynamic';

export default async function PreviewHighScoring() {
  const testData = {
    jobs: [
      {
        jobId: "kh715fagp5mq1v8e60hkyfrm517rtxtf",
        title: "Senior Frontend Engineer",
        company: "Tech Innovations Inc.",
        url: "https://linkedin.com/jobs/view/123456",
        aiScore: 9.2,
        applyUrl: "https://company.com/apply/123",
      },
      {
        jobId: "kh715fagp5mq1v8e60hkyfrm517rtxt2",
        title: "React Developer - Remote",
        company: "Global Software Solutions",
        url: "https://linkedin.com/jobs/view/234567",
        aiScore: 8.7,
        applyUrl: "https://company.com/apply/234",
      },
      {
        jobId: "kh715fagp5mq1v8e60hkyfrm517rtxt3",
        title: "Full Stack Developer",
        company: "StartUp Ventures LLC",
        url: "https://linkedin.com/jobs/view/345678",
        aiScore: 8.5,
      },
      {
        jobId: "kh715fagp5mq1v8e60hkyfrm517rtxt4",
        title: "Lead Frontend Architect",
        company: "Enterprise Systems Corp",
        url: "https://linkedin.com/jobs/view/456789",
        aiScore: 9.5,
        applyUrl: "https://company.com/apply/456",
      },
      {
        jobId: "kh715fagp5mq1v8e60hkyfrm517rtxt5",
        title: "JavaScript Engineer",
        company: "Digital Media Group",
        url: "https://linkedin.com/jobs/view/567890",
        aiScore: 7.8,
      },
    ],
    totalJobsScraped: 84,
    userEmail: "user@example.com",
    scrapeName: "Senior React Developer - San Francisco",
  };

  const emailHtml = await render(HighScoringJobsEmail(testData));

  return (
    <div style={{ padding: "20px", backgroundColor: "#f0f0f0" }}>
      <h1 style={{ marginBottom: "20px" }}>Email Preview: High-Scoring Jobs</h1>
      <div style={{ border: "2px solid #ccc", borderRadius: "8px", overflow: "hidden", backgroundColor: "white" }}>
        <iframe
          srcDoc={emailHtml}
          style={{ width: "100%", minHeight: "800px", border: "none" }}
          title="Email Preview"
        />
      </div>
    </div>
  );
}
