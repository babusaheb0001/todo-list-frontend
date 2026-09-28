'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, CheckSquare, Clock, CreditCard, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Tasks', href: '/study-plan', icon: CheckSquare },
  { name: 'Focus', href: '/focus', icon: Clock },
  { name: 'Expenses', href: '/expenses', icon: CreditCard },
];

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <nav className="md:hidden bg-white border-t border-slate-200 flex items-center justify-between px-2 pb-safe pt-1 relative z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      {navItems.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.name}
            href={item.href}
            className={`flex flex-col items-center justify-center w-full py-2 ${
              isActive ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <item.icon className={`w-5 h-5 mb-1 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
            <span className="text-[10px] font-medium">{item.name}</span>
          </Link>
        );
      })}
      <button
        onClick={handleLogout}
        className="flex flex-col items-center justify-center w-full py-2 text-slate-500 hover:text-slate-900"
      >
        <LogOut className="w-5 h-5 mb-1 text-slate-400" />
        <span className="text-[10px] font-medium">Logout</span>
      </button>
    </nav>
  );
}
