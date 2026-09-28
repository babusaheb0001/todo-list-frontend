import { AuthForm } from '@/components/auth-form';

export const metadata = {
  title: 'Sign Up - Student Productivity Hub',
};

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <AuthForm type="signup" />
    </div>
  );
}
