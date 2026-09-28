'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Expense, Budget, ExpenseCategory } from '@/lib/types';
import {
  DollarSign,
  Plus,
  Trash2,
  Filter,
  PieChart as PieChartIcon,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  Calendar,
  Tag,
  CheckCircle2,
  X
} from 'lucide-react';

const CATEGORIES: ExpenseCategory[] = ['Food', 'Transport', 'Books', 'Rent', 'Entertainment', 'Other'];

export default function ExpensesPage() {
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState<string>('');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isBudgetOpen, setIsBudgetOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Food');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Budget form state
  const [budgetInput, setBudgetInput] = useState('');

  // Filter state
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Load data
  const loadExpenses = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // Fetch expenses
      const { data: expenseData } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (expenseData) setExpenses(expenseData as Expense[]);

      // Fetch budget
      const { data: budgetData } = await supabase
        .from('budgets')
        .select('*')
        .eq('user_id', user.id)
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .maybeSingle();

      if (budgetData) {
        setBudget(budgetData as Budget);
        setBudgetInput(budgetData.budget_amount.toString());
      }
    } catch (err) {
      console.error('Error loading expenses:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase, currentMonth, currentYear]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  // Add Expense
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    try {
      const { error } = await supabase.from('expenses').insert([
        {
          user_id: userId,
          amount: parseFloat(amount),
          category,
          description: description.trim() || null,
          date,
        }
      ]);

      if (error) throw error;

      setIsAddOpen(false);
      setAmount('');
      setDescription('');
      loadExpenses();
    } catch (err) {
      console.error('Error adding expense:', err);
      alert('Failed to save expense.');
    }
  };

  // Save Budget
  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    const budgetVal = parseFloat(budgetInput);
    if (isNaN(budgetVal) || budgetVal < 0) {
      alert('Please enter a valid budget amount.');
      return;
    }

    try {
      if (budget) {
        await supabase
          .from('budgets')
          .update({ budget_amount: budgetVal })
          .eq('id', budget.id);
      } else {
        await supabase.from('budgets').insert([
          {
            user_id: userId,
            month: currentMonth,
            year: currentYear,
            budget_amount: budgetVal,
          }
        ]);
      }
      setIsBudgetOpen(false);
      loadExpenses();
    } catch (err) {
      console.error('Error saving budget:', err);
      alert('Failed to update budget.');
    }
  };

  // Delete Expense
  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    try {
      await supabase.from('expenses').delete().eq('id', id);
      setExpenses((prev) => prev.filter((exp) => exp.id !== id));
    } catch (err) {
      console.error('Error deleting expense:', err);
    }
  };

  // Calculations
  const currentMonthExpenses = expenses.filter((exp) => {
    const d = new Date(exp.date);
    return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear;
  });

  const totalSpent = currentMonthExpenses.reduce((acc, exp) => acc + Number(exp.amount), 0);
  const budgetLimit = budget?.budget_amount || 0;
  const remainingBudget = budgetLimit - totalSpent;
  const percentSpent = budgetLimit > 0 ? Math.min(Math.round((totalSpent / budgetLimit) * 100), 100) : 0;

  // Category breakdown
  const categoryTotals = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = currentMonthExpenses
      .filter((exp) => exp.category === cat)
      .reduce((sum, exp) => sum + Number(exp.amount), 0);
    return acc;
  }, {} as Record<ExpenseCategory, number>);

  // Filtered list
  const filteredExpenses = selectedCategory === 'All'
    ? expenses
    : expenses.filter((exp) => exp.category === selectedCategory);

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'Food': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Transport': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Books': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Rent': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Entertainment': return 'bg-pink-50 text-pink-700 border-pink-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Student Expenses</h1>
          <p className="text-slate-500 mt-1">
            Track your living costs, textbooks, and manage your monthly student budget.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsBudgetOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-sm transition-all"
          >
            <DollarSign className="w-4 h-4 text-emerald-600" />
            Set Budget
          </button>
          <button
            onClick={() => setIsAddOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Add Expense
          </button>
        </div>
      </div>

      {/* Monthly Budget Summary Banner */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {now.toLocaleString('default', { month: 'long' })} {currentYear} Budget
            </span>
            <div className="flex items-baseline gap-3 mt-1.5">
              <span className="text-3xl md:text-4xl font-black text-slate-900">
                ₹{totalSpent.toLocaleString()}
              </span>
              <span className="text-sm text-slate-400 font-medium">
                spent of ₹{budgetLimit.toLocaleString()} budget
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-right min-w-[130px]">
              <span className="text-[11px] font-semibold text-slate-400 uppercase">Remaining</span>
              <p className={`text-lg font-bold ${remainingBudget < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                ₹{remainingBudget.toLocaleString()}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-right min-w-[100px]">
              <span className="text-[11px] font-semibold text-slate-400 uppercase">Used</span>
              <p className="text-lg font-bold text-slate-800">{percentSpent}%</p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-6">
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${
                percentSpent > 90 ? 'bg-rose-500' : percentSpent > 75 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${percentSpent}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-xs text-slate-400 mt-2">
            <span>₹0</span>
            <span>{percentSpent > 85 ? '⚠️ Warning: Approaching monthly limit' : 'Healthy pace'}</span>
            <span>₹{budgetLimit.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Category Breakdown Chips */}
      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-3">This Month by Category</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {CATEGORIES.map((cat) => (
            <div
              key={cat}
              className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm text-center"
            >
              <span className="text-xs font-semibold text-slate-500">{cat}</span>
              <p className="text-base font-extrabold text-slate-800 mt-1">
                ₹{(categoryTotals[cat] || 0).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Expenses History List */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Expense Log</h3>
            <p className="text-xs text-slate-400">All recorded transactions</p>
          </div>

          {/* Category filter */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setSelectedCategory('All')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                selectedCategory === 'All'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  selectedCategory === cat
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 divide-y divide-slate-100">
          {loading ? (
            <div className="py-8 text-center text-slate-400 text-xs">Loading expenses...</div>
          ) : filteredExpenses.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              No expenses found under &quot;{selectedCategory}&quot;. Click &quot;Add Expense&quot; above to log your spending.
            </div>
          ) : (
            filteredExpenses.map((exp) => (
              <div
                key={exp.id}
                className="py-3.5 flex items-center justify-between hover:bg-slate-50/60 px-2 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs">
                    ₹
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {exp.description || exp.category}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getCategoryColor(exp.category)}`}>
                        {exp.category}
                      </span>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(exp.date).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-extrabold text-slate-900 text-sm">
                    -₹{Number(exp.amount).toLocaleString()}
                  </span>
                  <button
                    onClick={() => handleDeleteExpense(exp.id)}
                    className="p-2 text-slate-300 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Expense Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-lg">Add New Expense</h3>
              <button
                onClick={() => setIsAddOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Amount (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 250"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full text-base font-bold bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Description / Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Science book, Lunch with friends"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 font-semibold text-xs text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Set Budget Modal */}
      {isBudgetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-lg">
                Set {now.toLocaleString('default', { month: 'long' })} Budget
              </h3>
              <button
                onClick={() => setIsBudgetOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBudget} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Target Monthly Limit (₹) *
                </label>
                <input
                  type="number"
                  step="1"
                  required
                  placeholder="e.g. 10000"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  className="w-full text-lg font-bold bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsBudgetOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 font-semibold text-xs text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md"
                >
                  Save Budget
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
