import AyahDisplay from "@/components/AyahDisplay";
import LoginButton from "@/components/LoginButton";
import AuthShell from "@/components/AuthShell";

export default function LoginPage() {
  return (
    <AuthShell aside={<AyahDisplay />}>
      <div className="bg-white border border-line rounded-hero p-6 md:p-8 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="m-0 font-display font-semibold text-[26px] md:text-[28px] leading-tight text-forest">Daxil ol</h2>
          <p className="m-0 text-[15px] leading-relaxed text-muted">
            Google hesabınla daxil ol. Dəvət linki ilə gəlmisənsə, girişdən sonra qrupa qoşulma istəyin qrup sahibinə göndəriləcək.
          </p>
        </div>
        <LoginButton />
        <div className="text-xs text-muted text-center">© {new Date().getFullYear()} Xətm App</div>
      </div>
    </AuthShell>
  );
}
