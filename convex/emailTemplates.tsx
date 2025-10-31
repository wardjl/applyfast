import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

const baseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : '';
const appBaseUrl = (baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://applyfa.st').replace(/\/$/, '');

interface ScrapeCompletionEmailProps {
  scrapeName: string;
  totalJobs: number;
  dashboardUrl: string;
  scrapeId: string;
}

export const ScrapeCompletionEmail = ({
  scrapeName,
  totalJobs,
  dashboardUrl,
  scrapeId,
}: ScrapeCompletionEmailProps) => (
  <Html>
    <Head />
    <Body style={main}>
      <Preview>{`Scrape "${scrapeName}" completed - ${totalJobs} jobs found`}</Preview>
      <Container style={container}>
        <Section style={box}>
          <Text style={paragraph}>
            Scrape completed: <strong>{scrapeName}</strong>
          </Text>
          <Text style={details}>
            • Jobs found: {totalJobs}<br/>
            • Completed: {new Date().toLocaleString()}<br/>
            • ID: {scrapeId}
          </Text>
          <Button style={button} href={dashboardUrl}>
            View Jobs
          </Button>
        </Section>
      </Container>
    </Body>
  </Html>
);

export default ScrapeCompletionEmail;

interface HighScoringJob {
  jobId: string;
  title: string;
  company: string;
  url: string;
  aiScore: number;
  applyUrl?: string;
}

interface HighScoringJobsEmailProps {
  jobs: HighScoringJob[];
  totalJobsScraped: number;
  userEmail: string;
  scrapeName?: string;
}

export const HighScoringJobsEmail = ({
  jobs,
  totalJobsScraped,
  userEmail,
  scrapeName,
}: HighScoringJobsEmailProps) => (
  <Html>
    <Head />
    <Body style={main}>
      <Preview>{`${jobs.length} high-scoring jobs found${scrapeName ? ` from "${scrapeName}"` : ""} (7+ rating)`}</Preview>
      <Container style={container}>
        <Section style={box}>
          <Text style={paragraph}>
            <strong>Your Daily Job Matches{scrapeName ? ` - ${scrapeName}` : ""}</strong>
          </Text>
          <Text style={details}>
            {scrapeName && (
              <>
                Scrape: <strong>{scrapeName}</strong><br/>
              </>
            )}
            Found <strong>{jobs.length}</strong> high-scoring jobs (7+ rating)<br/>
            Total jobs processed: {totalJobsScraped}<br/>
            Date: {new Date().toLocaleDateString()}
          </Text>

          {jobs.length > 0 && (
            <Section style={jobListSection}>
              <Text style={jobListHeader}>🌟 Top Job Matches:</Text>
              {jobs.map((job, index) => (
                <Section key={index} style={jobItem}>
                  <Link href={job.url} style={jobLink}>
                    <Text style={jobTitle}>{job.title}</Text>
                  </Link>
                  <Text style={jobCompany}>{job.company}</Text>
                  <Text style={jobScore}>AI Score: {job.aiScore}/10</Text>
                  <Section style={jobActions}>
                    <Button href={job.url} style={viewJobButton}>
                      View on LinkedIn
                    </Button>
                    <Button
                      href={`${appBaseUrl}/dashboard/jobs?job=${encodeURIComponent(job.jobId)}`}
                      style={applyFastButton}
                    >
                      Open in ApplyFast
                    </Button>
                    {job.applyUrl && (
                      <Button href={job.applyUrl} style={applyButton}>
                        Apply Directly
                      </Button>
                    )}
                  </Section>
                </Section>
              ))}
            </Section>
          )}

          <Text style={footerText}>
            Keep up the great work with your job search! 🚀
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
};

const box = {
  padding: '0 48px',
};

const hr = {
  borderColor: '#e0e0e0',
  margin: '20px 0',
};

const paragraph = {
  color: '#000000',
  fontSize: '16px',
  lineHeight: '24px',
  textAlign: 'left' as const,
};

const details = {
  color: '#000000',
  fontSize: '14px',
  lineHeight: '20px',
  textAlign: 'left' as const,
  backgroundColor: '#f5f5f5',
  padding: '20px',
  borderRadius: '4px',
  border: '1px solid #d0d0d0',
};

const anchor = {
  color: '#000000',
};

const button = {
  backgroundColor: '#000000',
  borderRadius: '5px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  padding: '12px 24px',
};

const footer = {
  color: '#666666',
  fontSize: '12px',
  lineHeight: '16px',
};

const jobListSection = {
  margin: '20px 0',
};

const jobListHeader = {
  color: '#000000',
  fontSize: '16px',
  fontWeight: 'bold',
  marginBottom: '15px',
  textAlign: 'left' as const,
};

const jobItem = {
  backgroundColor: '#f5f5f5',
  border: '1px solid #d0d0d0',
  borderRadius: '8px',
  padding: '20px',
  marginBottom: '16px',
};

const jobLink = {
  textDecoration: 'none',
};

const jobTitle = {
  color: '#000000',
  fontSize: '16px',
  fontWeight: 'bold',
  margin: '0 0 10px 0',
  textDecoration: 'none',
};

const jobCompany = {
  color: '#333333',
  fontSize: '14px',
  margin: '0 0 8px 0',
};

const jobScore = {
  color: '#000000',
  fontSize: '12px',
  fontWeight: 'bold',
  margin: '0 0 12px 0',
};

const jobActions = {
  display: 'flex',
  gap: '8px',
  marginTop: '12px',
  justifyContent: 'flex-start',
};

const viewJobButton = {
  backgroundColor: '#000000',
  color: '#ffffff',
  textDecoration: 'none',
  fontSize: '12px',
  fontWeight: 'bold',
  border: 'none',
  borderRadius: '4px',
  padding: '8px 16px',
  display: 'inline-block',
  textAlign: 'center' as const,
  minWidth: '120px',
  marginRight: '12px',
};

const applyFastButton = {
  backgroundColor: '#555555',
  color: '#ffffff',
  textDecoration: 'none',
  fontSize: '12px',
  fontWeight: 'bold',
  border: 'none',
  borderRadius: '4px',
  padding: '8px 16px',
  display: 'inline-block',
  textAlign: 'center' as const,
  minWidth: '120px',
  marginRight: '12px',
};

const applyButton = {
  backgroundColor: '#333333',
  color: '#ffffff',
  textDecoration: 'none',
  fontSize: '12px',
  fontWeight: 'bold',
  border: 'none',
  borderRadius: '4px',
  padding: '8px 16px',
  display: 'inline-block',
  textAlign: 'center' as const,
  minWidth: '120px',
};

const footerText = {
  color: '#333333',
  fontSize: '14px',
  lineHeight: '20px',
  textAlign: 'center' as const,
  marginTop: '20px',
};

interface NoHighScoringJobsEmailProps {
  totalJobsScraped: number;
  scrapeName: string;
  dashboardUrl: string;
}

export const NoHighScoringJobsEmail = ({
  totalJobsScraped,
  scrapeName,
  dashboardUrl,
}: NoHighScoringJobsEmailProps) => (
  <Html>
    <Head />
    <Body style={main}>
      <Preview>{`Job search update: ${totalJobsScraped} jobs processed, keep searching!`}</Preview>
      <Container style={container}>
        <Section style={box}>
          <Text style={paragraph}>
            ✉️ <strong>Daily Job Search Update</strong>
          </Text>
          <Text style={details}>
            Scrape completed: <strong>{scrapeName}</strong><br/>
            Jobs processed: {totalJobsScraped}<br/>
            Date: {new Date().toLocaleDateString()}<br/>
            High-scoring matches (7+): None today
          </Text>

          <Section style={encouragementSection}>
            <Text style={encouragementText}>
              💪 No high-scoring matches today, but don't give up!
            </Text>
            <Text style={tipText}>
              • The job market changes daily - new opportunities appear constantly<br/>
              • Consider reviewing your search criteria or expanding to new locations<br/>
              • Your perfect match might be in tomorrow's results
            </Text>
          </Section>

          <Button style={button} href={dashboardUrl}>
            Review All Jobs
          </Button>

          <Text style={footerText}>
            Keep pushing forward - your next opportunity is out there! 🚀
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

const encouragementSection = {
  backgroundColor: '#f5f5f5',
  border: '1px solid #d0d0d0',
  borderRadius: '8px',
  padding: '20px',
  margin: '20px 0',
};

const encouragementText = {
  color: '#000000',
  fontSize: '16px',
  fontWeight: 'bold',
  margin: '0 0 12px 0',
  textAlign: 'center' as const,
};

const tipText = {
  color: '#333333',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0',
};
