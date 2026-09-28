'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Task, FocusSession, Expense, Budget } from '@/lib/types';
import { TaskForm } from '@/components/study/task-form';
import {
  CheckCircle2,
  Clock,
  Flame,
  Plus,
  Play,
  Pause,
  RotateCcw,
  Calendar,
  DollarSign,
  BookOpen,
  ArrowRight,
  Sparkles,
  Check,
  Coffee,
  AlertCircle
} from 'lucide-react';

export default function DashboardPage() {
  const supabase = useMemo(() => createClient(), []);

  const [userEmail, setUserEmail] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(true);

  // Quick Task Form modal state
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);

  // Dashboard Focus Timer Widget State
  const [timerMode, setTimerMode] = useState<'focus' | 'break'>('focus');
  const [timerDuration, setTimerDuration] = useState<number>(25 * 60); // 25 mins
  const [timeLeft, setTimeLeft] = useState<number>(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [timerSessionStartTime, setTimerSessionStartTime] = useState<Date | null>(null);

  // Fetch all dashboard data
  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserEmail(user.email || 'Student');
      setUserId(user.id);

      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      // 1. Fetch Tasks
      const { data: taskData } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (taskData) setTasks(taskData as Task[]);

      // 2. Fetch Focus Sessions
      const { data: sessionData } = await supabase
        .from('focus_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (sessionData) setSessions(sessionData as FocusSession[]);

      // 3. Fetch Expenses for current month
      const startOfMonth = new Date(currentYear, currentMonth - 1, 1).toISOString().split('T')[0];
      const endOfMonth = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];

      const { data: expenseData } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startOfMonth)
        .lte('date', endOfMonth)
        .order('date', { ascending: false });

      if (expenseData) setExpenses(expenseData as Expense[]);

      // 4. Fetch Budget
      const { data: budgetData } = await supabase
        .from('budgets')
        .select('*')
        .eq('user_id', user.id)
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .maybeSingle();

      if (budgetData) setBudget(budgetData as Budget);

    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Focus Timer Tick
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTimerRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (isTimerRunning && timeLeft === 0) {
      setIsTimerRunning(false);
      handleSessionComplete();
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, timeLeft]);

  const handleStartTimer = () => {
    if (!isTimerRunning && !timerSessionStartTime) {
      setTimerSessionStartTime(new Date());
    }
    setIsTimerRunning(true);
  };

  const handlePauseTimer = () => {
    setIsTimerRunning(false);
  };

  const handleResetTimer = (minutes: number = 25, mode: 'focus' | 'break' = 'focus') => {
    setIsTimerRunning(false);
    setTimerMode(mode);
    setTimerDuration(minutes * 60);
    setTimeLeft(minutes * 60);
    setTimerSessionStartTime(null);
  };

  const handleSessionComplete = async () => {
    if (timerMode === 'focus' && userId) {
      const durationMins = Math.round(timerDuration / 60);
      try {
        await supabase.from('focus_sessions').insert([
          {
            user_id: userId,
            task_id: selectedTaskId || null,
            start_time: timerSessionStartTime ? timerSessionStartTime.toISOString() : new Date(Date.now() - timerDuration * 1000).toISOString(),
            end_time: new Date().toISOString(),
            duration_minutes: durationMins,
            completed: true,
          }
        ]);
        alert(`🎉 Focus session completed! You logged ${durationMins} minutes of productive study!`);
        loadDashboardData();
      } catch (err) {
        console.error('Failed to log completed session:', err);
      }
    }
    handleResetTimer(5, 'break');
  };

  // Quick toggle task completion
  const handleToggleTask = async (task: Task) => {
    const newStatus = task.status === 'Completed' ? 'Not Started' : 'Completed';
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t))
    );
    try {
      await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', task.id);
    } catch (err) {
      console.error('Failed to update task:', err);
      loadDashboardData();
    }
  };

  // Calculated Stats
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'Completed').length;
  const pendingTasks = tasks.filter((t) => t.status !== 'Completed');
  const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const totalFocusMinutes = sessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0);
  const totalFocusHours = (totalFocusMinutes / 60).toFixed(1);

  const totalSpent = expenses.reduce((acc, exp) => acc + Number(exp.amount), 0);
  const budgetAmount = budget?.budget_amount || 0;
  const budgetPercentage = budgetAmount > 0 ? Math.min(Math.round((totalSpent / budgetAmount) * 100), 100) : 0;

  // Format timer seconds into MM:SS
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const timerProgress = timerDuration > 0 ? ((timerDuration - timeLeft) / timerDuration) * 100 : 0;

  // Priority color helper
  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'High':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'Medium':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-10">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-700 p-6 md:p-8 text-white shadow-xl shadow-blue-500/10">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold text-blue-100 mb-3 border border-white/20">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Smart Productivity Hub</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Welcome back, {userEmail.split('@')[0]}! 🚀
            </h1>
            <p className="mt-1.5 text-blue-100/90 text-sm md:text-base max-w-xl">
              Stay organized, track your study focus sessions, and maintain full control over your budget.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsTaskFormOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-blue-700 font-semibold text-sm shadow-md hover:bg-blue-50 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              New Task
            </button>
            <Link
              href="/focus"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-700/60 hover:bg-blue-700/80 text-white font-medium text-sm border border-white/20 transition-all backdrop-blur-sm"
            >
              <Clock className="w-4 h-4" />
              Focus Mode
            </Link>
          </div>
        </div>

        {/* Decorative background blurs */}
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-48 h-48 bg-blue-400/20 rounded-full blur-xl pointer-events-none" />
      </div>

      {/* Task Creation Modal */}
      {isTaskFormOpen && (
        <TaskForm
          task={null}
          onClose={() => setIsTaskFormOpen(false)}
          onSuccess={() => {
            setIsTaskFormOpen(false);
            loadDashboardData();
          }}
        />
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        {/* Card 1: Study Tasks */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tasks Pending</span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{pendingTasks.length}</span>
            <span className="text-xs text-slate-400 font-medium">of {totalTasks} total</span>
          </div>
          <div className="mt-3">
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${taskCompletionRate}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[11px] text-slate-500 mt-1.5">
              <span>{taskCompletionRate}% completed</span>
              <Link href="/study-plan" className="text-blue-600 font-medium hover:underline inline-flex items-center gap-0.5">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* Card 2: Focus Hours */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Focus Logged</span>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{totalFocusHours}</span>
            <span className="text-xs text-slate-400 font-medium">hours</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-indigo-700 bg-indigo-50/80 px-2.5 py-1 rounded-lg w-fit">
            <Flame className="w-3.5 h-3.5" />
            <span>{sessions.length} sessions completed</span>
          </div>
        </div>

        {/* Card 3: Monthly Expenses */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Month Spending</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">₹{totalSpent.toLocaleString()}</span>
          </div>
          <div className="mt-3">
            {budgetAmount > 0 ? (
              <>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-500 ${
                      budgetPercentage > 85 ? 'bg-rose-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${budgetPercentage}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[11px] text-slate-500 mt-1.5">
                  <span>₹{(budgetAmount - totalSpent).toLocaleString()} left</span>
                  <span className="font-semibold text-slate-700">{budgetPercentage}% used</span>
                </div>
              </>
            ) : (
              <Link href="/expenses" className="text-xs text-blue-600 font-medium hover:underline inline-flex items-center gap-1">
                + Set monthly budget
              </Link>
            )}
          </div>
        </div>

        {/* Card 4: Focus Streak / Status */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Study Streak</span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
              <Flame className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">
              {sessions.length > 0 ? 'Active' : 'Ready'}
            </span>
            <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">
              On Track
            </span>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {pendingTasks.length > 0
              ? `${pendingTasks[0].title.slice(0, 24)}... next`
              : 'All scheduled tasks clear!'}
          </p>
        </div>
      </div>

      {/* Main Grid: Focus Timer Widget & Tasks Checklist */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Quick Focus Timer Widget (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Quick Focus Timer</h3>
                  <p className="text-xs text-slate-400">Pomodoro focus session</p>
                </div>
              </div>

              {/* Mode switch */}
              <div className="flex items-center p-1 bg-slate-100 rounded-xl">
                <button
                  onClick={() => handleResetTimer(25, 'focus')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                    timerMode === 'focus' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Focus
                </button>
                <button
                  onClick={() => handleResetTimer(5, 'break')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                    timerMode === 'break' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Break
                </button>
              </div>
            </div>

            {/* Timer Display */}
            <div className="py-8 flex flex-col items-center justify-center text-center">
              <div className="relative w-48 h-48 flex items-center justify-center">
                {/* SVG Progress Circle */}
                <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    className="stroke-slate-100"
                    strokeWidth="6"
                    fill="transparent"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    className={`${
                      timerMode === 'focus' ? 'stroke-indigo-600' : 'stroke-emerald-500'
                    } transition-all duration-300`}
                    strokeWidth="6"
                    strokeDasharray={2 * Math.PI * 44}
                    strokeDashoffset={2 * Math.PI * 44 * (1 - timerProgress / 100)}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>

                <div className="absolute flex flex-col items-center">
                  <span className="text-4xl font-extrabold text-slate-900 tracking-tight font-mono">
                    {formatTime(timeLeft)}
                  </span>
                  <span className="text-xs font-medium text-slate-400 mt-1 capitalize flex items-center gap-1">
                    {timerMode === 'focus' ? <Flame className="w-3 h-3 text-amber-500" /> : <Coffee className="w-3 h-3 text-emerald-500" />}
                    {timerMode === 'focus' ? 'Study Interval' : 'Short Break'}
                  </span>
                </div>
              </div>

              {/* Task Link Selector */}
              {pendingTasks.length > 0 && (
                <div className="w-full max-w-xs mt-4">
                  <select
                    value={selectedTaskId}
                    onChange={(e) => setSelectedTaskId(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Link to a task (optional) --</option>
                    {pendingTasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} ({t.subject || 'General'})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Timer Controls */}
          <div className="flex items-center justify-center gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={() => handleResetTimer(timerMode === 'focus' ? 25 : 5, timerMode)}
              className="p-3 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              title="Reset Timer"
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            {isTimerRunning ? (
              <button
                onClick={handlePauseTimer}
                className="flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl shadow-md transition-all active:scale-95"
              >
                <Pause className="w-5 h-5" />
                Pause
              </button>
            ) : (
              <button
                onClick={handleStartTimer}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-md transition-all active:scale-95"
              >
                <Play className="w-5 h-5" />
                Start Focus
              </button>
            )}

            <Link
              href="/focus"
              className="p-3 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              title="Full Focus Tracker"
            >
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>

        {/* Right Column: Tasks Checklist & Priority Queue (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Today&apos;s Study Tasks</h3>
                  <p className="text-xs text-slate-400">Click checkmark to toggle complete</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsTaskFormOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
                <Link
                  href="/study-plan"
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                >
                  View All
                </Link>
              </div>
            </div>

            {/* Tasks list */}
            <div className="mt-4 space-y-2.5">
              {loading ? (
                <div className="space-y-3 py-4 animate-pulse">
                  <div className="h-12 bg-slate-100 rounded-xl" />
                  <div className="h-12 bg-slate-100 rounded-xl" />
                  <div className="h-12 bg-slate-100 rounded-xl" />
                </div>
              ) : tasks.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
                  <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">No tasks created yet</h4>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
                    Add your syllabus chapters, assignments, or study targets to track progress.
                  </p>
                  <button
                    onClick={() => setIsTaskFormOpen(true)}
                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Create First Task
                  </button>
                </div>
              ) : (
                tasks.slice(0, 5).map((task) => {
                  const isCompleted = task.status === 'Completed';
                  return (
                    <div
                      key={task.id}
                      className={`group flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                        isCompleted
                          ? 'bg-slate-50/70 border-slate-200/60 opacity-60'
                          : 'bg-white border-slate-200/80 hover:border-blue-300 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          onClick={() => handleToggleTask(task)}
                          className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                            isCompleted
                              ? 'bg-emerald-500 text-white'
                              : 'border-2 border-slate-300 hover:border-blue-500 text-transparent'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </button>
                        <div className="min-w-0">
                          <p
                            className={`text-sm font-semibold truncate ${
                              isCompleted ? 'line-through text-slate-400' : 'text-slate-800'
                            }`}
                          >
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                            {task.subject && (
                              <span className="font-medium text-slate-600">{task.subject}</span>
                            )}
                            {task.due_date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(task.due_date).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getPriorityBadge(
                            task.priority
                          )}`}
                        >
                          {task.priority}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Quick Footer stats */}
          {tasks.length > 5 && (
            <div className="pt-3 mt-2 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
              <span>Showing 5 of {tasks.length} tasks</span>
              <Link href="/study-plan" className="text-blue-600 font-semibold hover:underline inline-flex items-center gap-1">
                View remaining {tasks.length - 5} tasks <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Section: Recent Focus Sessions & Quick Expense Preview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Focus History */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-slate-900 text-base">Recent Focus Sessions</h3>
            </div>
            <Link href="/focus" className="text-xs font-semibold text-blue-600 hover:underline">
              Open Tracker
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {sessions.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                No focus sessions logged yet. Start the Pomodoro timer to build your streak!
              </div>
            ) : (
              sessions.slice(0, 4).map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                      {s.duration_minutes || 25}m
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800">
                        {s.completed ? 'Focus Session Completed' : 'Session'}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {new Date(s.start_time).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })} at {new Date(s.start_time).toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    ✓ Done
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Expenses Preview */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-slate-900 text-base">Recent Expenses</h3>
            </div>
            <Link href="/expenses" className="text-xs font-semibold text-blue-600 hover:underline">
              Manage Expenses
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {expenses.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                No expenses logged this month. Track food, books, or transport in Expenses.
              </div>
            ) : (
              expenses.slice(0, 4).map((exp) => (
                <div
                  key={exp.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100"
                >
                  <div>
                    <p className="text-xs font-semibold text-slate-800">
                      {exp.description || exp.category}
                    </p>
                    <span className="text-[10px] font-medium text-slate-500 bg-slate-200/70 px-1.5 py-0.5 rounded">
                      {exp.category}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-900">
                      -₹{Number(exp.amount).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-slate-400">{exp.date}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
