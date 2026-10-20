// Split layout for the signed-out screens (login, onboarding):
// brand panel on the left (top on mobile), content card on the right, both on the warm ground.
import type { ReactNode } from "react";
import { Logo } from "./ui";

export default function AuthShell({ aside, children }: { aside?: ReactNode; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-cream text-ink flex flex-col md:flex-row">
      <section className="md:w-[44%] lg:w-[40%] shrink-0 flex flex-col gap-8 px-5 pt-10 pb-2 md:px-12 md:py-14">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-[14px] bg-tile flex items-center justify-center">
            <Logo />
          </div>
          <span className="font-extrabold text-[22px] tracking-[-0.01em] text-ink">Xətm</span>
        </div>

        <div className="flex flex-col gap-3">
          <h1 className="m-0 font-extrabold text-[34px] md:text-[48px] leading-[1.08] tracking-[-0.02em] text-ink">Birlikdə Quranı xətm edək</h1>
          <p className="m-0 text-[15px] md:text-base leading-relaxed text-muted max-w-md">
            Qrup yarat, 30 cüzü iştirakçılar arasında böl, hər kəsin oxuma gedişatını bir yerdən izlə.
          </p>
        </div>

        {aside && <div className="md:mt-auto">{aside}</div>}
      </section>

      <section className="flex-1 flex items-start md:items-center justify-center px-5 py-8 md:px-12">
        <div className="w-full max-w-md">{children}</div>
      </section>
    </main>
  );
}
