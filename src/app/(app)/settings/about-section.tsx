import { Card } from "@/components/ui/card";
import { REPOSITORY_URL, UPSTREAM_URL } from "@/lib/releases";

import { SettingsSectionIntro } from "./settings-screen";

export type AboutFacts = { label: string; value: string }[];

const LINK = "font-medium text-ink underline underline-offset-2";

/**
 * Settings → About (E10-9, SET-12): facts about this install, where its
 * source code is (AGPL section 13), and the credit to Dossier.
 */
export function AboutSection({ facts }: { facts: AboutFacts }) {
  return (
    <>
      <SettingsSectionIntro title="About this install">Free and open source software, under the GNU AGPL v3.</SettingsSectionIntro>
      <Card padding="none" className="px-7 py-2">
        <dl>
          {facts.map(({ label, value }) => (
            <div key={label} className="flex justify-between gap-4 border-t border-line py-3.5 text-sm first:border-t-0">
              <dt className="text-muted">{label}</dt>
              <dd className="text-right font-mono text-[13px] [overflow-wrap:anywhere]">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <p className="text-meta text-muted">
        RolePebble is built on{" "}
        <a href={UPSTREAM_URL} target="_blank" rel="noopener noreferrer" className={LINK}>
          Dossier <span className="sr-only">(opens in a new tab)</span>
        </a>{" "}
        by AienTech. You can get, change and share its{" "}
        <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer" className={LINK}>
          source code <span className="sr-only">(opens in a new tab)</span>
        </a>{" "}
        under the GNU Affero General Public License, version 3.
      </p>
    </>
  );
}
