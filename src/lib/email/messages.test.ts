import { describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ DOSSIER_PUBLIC_URL: "https://rolepebble.com" as string | undefined }));
vi.mock("@/lib/env", () => ({ env }));

const { confirmEmailMessage, emailChangedMessage, resetPasswordMessage } = await import("./messages");

const token = "q6GQd3vX0bS7Zr8m1kQyJ9wE2tA5cH4uN0pL7oI3sXw";

describe("confirmEmailMessage", () => {
  const message = confirmEmailMessage({ to: "jane@example.com", name: "Jane", token });

  it("greets by name and links to the confirmation page with the token", () => {
    expect(message.to).toBe("jane@example.com");
    expect(message.subject).toBe("Confirm your email for RolePebble");
    expect(message.text).toMatch(/^Hi Jane,\n\n/);
    expect(message.text).toContain(`\n\nhttps://rolepebble.com/verify-email?token=${token}\n\n`);
    expect(message.text).toContain("24 hours");
    expect(message.html).toContain(`href="https://rolepebble.com/verify-email?token=${token}"`);
  });

  it("is signed RolePebble and names the support address", () => {
    expect(message.text).toMatch(/Questions\? Write to support@rolepebble\.com\.\n\nRolePebble\n$/);
    expect(message.html).toContain("support@rolepebble.com");
  });
});

describe("resetPasswordMessage", () => {
  it("links to the reset page with the token, for an hour", () => {
    const message = resetPasswordMessage({ to: "sam@example.com", name: null, token });
    expect(message.subject).toBe("Reset your RolePebble password");
    expect(message.text).toMatch(/^Hi there,\n\n/);
    expect(message.text).toContain(`https://rolepebble.com/reset-password?token=${token}`);
    expect(message.text).toContain("1 hour");
    expect(message.html).toContain(`href="https://rolepebble.com/reset-password?token=${token}"`);
  });
});

describe("emailChangedMessage", () => {
  it("tells the old address, without spelling out the new one", () => {
    const message = emailChangedMessage({ to: "old@example.com", name: "Jane", newEmail: "new@example.org" });
    expect(message.to).toBe("old@example.com");
    expect(message.subject).toBe("Your RolePebble email address was changed");
    expect(message.text).toContain("n***@example.org");
    expect(message.text).not.toContain("new@example.org");
    expect(message.text).toContain("https://rolepebble.com/login");
    expect(message.text).toContain("If you didn't make this change, write to support@rolepebble.com");
  });
});

describe("links", () => {
  it("point at the development server without DOSSIER_PUBLIC_URL", () => {
    env.DOSSIER_PUBLIC_URL = undefined;
    try {
      expect(confirmEmailMessage({ to: "jane@example.com", token }).text).toContain(
        `http://localhost:3000/verify-email?token=${token}`,
      );
    } finally {
      env.DOSSIER_PUBLIC_URL = "https://rolepebble.com";
    }
  });

  it("keep a path in DOSSIER_PUBLIC_URL and encode the token", () => {
    env.DOSSIER_PUBLIC_URL = "https://example.com/rolepebble";
    try {
      expect(resetPasswordMessage({ to: "jane@example.com", token: "a b&c" }).text).toContain(
        "https://example.com/rolepebble/reset-password?token=a%20b%26c",
      );
    } finally {
      env.DOSSIER_PUBLIC_URL = "https://rolepebble.com";
    }
  });
});

describe("names", () => {
  it("are escaped in the HTML", () => {
    const name = `<img src=x onerror="alert('hi')"> & <script>alert(1)</script>`;
    const { html, text } = confirmEmailMessage({ to: "jane@example.com", name, token });
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script");
    expect(html).toContain("Hi &lt;img src=x onerror=&quot;alert(&#39;hi&#39;)&quot;&gt; &amp; &lt;script&gt;");
    // The text version is plain text, so it's left as typed.
    expect(text).toContain(`Hi ${name},`);
  });

  it("are kept on one line, without control characters, and short", () => {
    const { text, subject } = confirmEmailMessage({ to: "jane@example.com", name: "Jane\r\nBcc: evil@example.com\u0007", token });
    expect(text).toMatch(/^Hi Jane Bcc: evil@example\.com,\n/);
    expect(subject).not.toContain("Jane");

    const long = confirmEmailMessage({ to: "jane@example.com", name: "é".repeat(200), token });
    expect(long.text).toMatch(new RegExp(`^Hi ${"é".repeat(80)},\n`));
  });

  it("fall back to “there” when empty", () => {
    expect(confirmEmailMessage({ to: "jane@example.com", name: " \n ", token }).text).toMatch(/^Hi there,/);
  });
});
