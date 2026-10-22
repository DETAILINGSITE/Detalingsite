/**
 * The single transactional email layout. Content comes from
 * lib/server/notify/messages.ts so every message shares one accessible design.
 * Preview locally with `pnpm email:preview`.
 */
import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from "react-email";
import { business } from "@/config/business";
import type { MessageContent } from "@/lib/server/notify/messages";

const colors = {
  bg: "#f4f4f5",
  card: "#ffffff",
  text: "#18181b",
  muted: "#52525b",
  brand: "#0b0c0e",
  accent: business.colors.brand,
};

export function BrandedEmail({ message, siteUrl }: { message: MessageContent; siteUrl: string }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{message.preview}</Preview>
      <Body style={{ backgroundColor: colors.bg, fontFamily: "Helvetica, Arial, sans-serif", margin: 0, padding: "24px 0" }}>
        <Container style={{ backgroundColor: colors.card, borderRadius: 12, maxWidth: 560, padding: "32px 28px" }}>
          <Text style={{ color: colors.muted, fontSize: 13, letterSpacing: "0.08em", margin: 0, textTransform: "uppercase" }}>
            {business.name}
          </Text>
          <Heading as="h1" style={{ color: colors.text, fontSize: 24, lineHeight: "32px", margin: "12px 0 16px" }}>
            {message.heading}
          </Heading>
          {message.paragraphs.filter(Boolean).map((p, i) => (
            <Text key={i} style={{ color: colors.text, fontSize: 16, lineHeight: "24px", margin: "0 0 12px" }}>
              {p}
            </Text>
          ))}
          {message.details.length > 0 && (
            <Section style={{ borderTop: "1px solid #e4e4e7", marginTop: 16, paddingTop: 12 }}>
              {message.details.map((d) => (
                <Text key={d.label} style={{ color: colors.text, fontSize: 15, lineHeight: "22px", margin: "0 0 6px" }}>
                  <span style={{ color: colors.muted }}>{d.label}: </span>
                  <strong>{d.value}</strong>
                </Text>
              ))}
            </Section>
          )}
          {message.checklist && (
            <Section style={{ marginTop: 16 }}>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: 700, margin: "0 0 6px" }}>What to expect</Text>
              {message.checklist.map((item) => (
                <Text key={item} style={{ color: colors.text, fontSize: 15, lineHeight: "22px", margin: "0 0 4px" }}>
                  • {item}
                </Text>
              ))}
            </Section>
          )}
          {message.cta && (
            <Section style={{ marginTop: 24 }}>
              <Button
                href={message.cta.href}
                style={{
                  backgroundColor: colors.brand,
                  borderRadius: 8,
                  color: "#ffffff",
                  display: "inline-block",
                  fontSize: 16,
                  fontWeight: 700,
                  padding: "14px 22px",
                  textDecoration: "none",
                }}
              >
                {message.cta.label}
              </Button>
            </Section>
          )}
          <Hr style={{ borderColor: "#e4e4e7", margin: "28px 0 16px" }} />
          <Text style={{ color: colors.muted, fontSize: 13, lineHeight: "20px", margin: 0 }}>
            {business.name} · {business.contact.phoneDisplay} ·{" "}
            <Link href={siteUrl} style={{ color: colors.muted }}>
              {siteUrl.replace(/^https?:\/\//, "")}
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default function Preview_() {
  return (
    <BrandedEmail
      siteUrl="http://localhost:3000"
      message={{
        subject: "Preview",
        preview: "Preview",
        heading: "You're booked, Alex!",
        paragraphs: ["Thanks for booking with us."],
        details: [{ label: "When", value: "Tuesday, November 3, 2026 at 9:00 AM" }],
        cta: { label: "View or change booking", href: "http://localhost:3000" },
        sms: "",
      }}
    />
  );
}
