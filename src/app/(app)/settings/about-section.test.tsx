import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AboutSection } from "./about-section";

const facts = [
  { label: "Version", value: "0.1.0" },
  { label: "Database", value: "PostgreSQL · 9.0 MB" },
];

describe("About (E10-9)", () => {
  it("lists the install's facts", () => {
    render(<AboutSection facts={facts} />);
    expect(screen.getByRole("heading", { name: "About this install" })).toBeInTheDocument();
    expect(screen.getAllByRole("definition").map((value) => value.textContent)).toEqual(["0.1.0", "PostgreSQL · 9.0 MB"]);
    expect(screen.getByText("PostgreSQL · 9.0 MB")).toHaveClass("font-mono");
  });

  it("links to the source code and credits Dossier (AGPL)", () => {
    render(<AboutSection facts={facts} />);
    expect(screen.getByRole("link", { name: "source code (opens in a new tab)" })).toHaveAttribute("href", "https://github.com/mrahmadusama/dossier");
    expect(screen.getByRole("link", { name: "Dossier (opens in a new tab)" })).toHaveAttribute("href", "https://dossier.aien.me");
  });

  it("says who runs RolePebble and how to reach them", () => {
    render(<AboutSection facts={facts} />);
    expect(screen.getByText(/RolePebble is run by Ahmad Usama, not by the Dossier project/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "support@rolepebble.com" })).toHaveAttribute("href", "mailto:support@rolepebble.com");
  });
});
