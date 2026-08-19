import SidebarSignUp from "../components/SidebarSignUp";
import SignupFormFields from "../components/SignupFormFields";
import ThemeToggle from "../components/ThemeToggle";

function SignUp() {
  return (
    <div className="relative flex min-h-screen bg-white">

      <ThemeToggle compact className="absolute right-5 top-5 z-20" />

      <SidebarSignUp />

      <main className="flex-1 overflow-y-auto px-8 pt-12 pb-8 lg:px-12 xl:px-16">
        <SignupFormFields />
      </main>

    </div>
  );
}

export default SignUp;
