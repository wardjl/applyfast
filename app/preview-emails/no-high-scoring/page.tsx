import { NoHighScoringJobsEmail } from "../../../convex/emailTemplates";
import { render } from "@react-email/render";

export const dynamic = 'force-dynamic';

export default async function PreviewNoHighScoring() {
  const testData = {
    totalJobsScraped: 52,
    scrapeName: "Senior React Developer - San Francisco",
    dashboardUrl: "https://applyfa.st/dashboard/jobs",
  };

  const emailHtml = await render(NoHighScoringJobsEmail(testData));

  return (
    <div style={{ padding: "20px", backgroundColor: "#f0f0f0" }}>
      <h1 style={{ marginBottom: "20px" }}>Email Preview: No High-Scoring Jobs</h1>
      <div style={{ border: "2px solid #ccc", borderRadius: "8px", overflow: "hidden", backgroundColor: "white" }}>
        <iframe
          srcDoc={emailHtml}
          style={{ width: "100%", minHeight: "600px", border: "none" }}
          title="Email Preview"
        />
      </div>
    </div>
  );
}
