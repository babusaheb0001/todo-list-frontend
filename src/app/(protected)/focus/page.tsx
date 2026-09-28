'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Task, FocusSession, Distraction } from '@/lib/types';
import {
  Play,
  Pause,
  RotateCcw,
  Coffee,
  Flame,
  CheckCircle2,
  AlertTriangle,
  History,
  Tag,
  Volume2,
  Sparkles,
  Calendar,
  Check
} from 'lucide-react';

export default function FocusPage() {
  const supabase = useMemo(() => createClient(), []);

  // Timer settings
  const [mode, setMode] = useState<'focus' | 'shortBreak' | 'longBreak'>('focus');
  const [durationMinutes, setDurationMinutes] = useState<number>(25);
  const [timeLeft, setTimeLeft] = useState<number>(25 * 60);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [sessionStart, setSessionStart] = useState<Date | null>(null);

  // Database records
  const [userId, setUserId] = useState<string>('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [distractions, setDistractions] = useState<Distraction[]>([]);
  const [loading, setLoading] = useState(true);

  // Distraction logging state
  const [customDistraction, setCustomDistraction] = useState('');
  const distractionTags = ['Social Media', 'Phone Call', 'Noise', 'Daydreaming', 'Snack / Thirst', 'Family / Roommate'];

  // Load user data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // Fetch pending tasks
      const { data: taskData } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .neq('status', 'Completed')
        .order('priority', { ascending: false });

      if (taskData) setTasks(taskData as Task[]);

      // Fetch past focus sessions
      const { data: sessionData } = await supabase
        .from('focus_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (sessionData) setSessions(sessionData as FocusSession[]);

      // Fetch recent distractions
      const { data: distractionData } = await supabase
        .from('distractions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (distractionData) setDistractions(distractionData as Distraction[]);
    } catch (err) {
      console.error('Error loading focus data:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Timer Tick
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isRunning && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (isRunning && timeLeft === 0) {
      setIsRunning(false);
      handleCompleteSession();
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRunning, timeLeft]);

  // Switch modes
  const handleModeChange = (newMode: 'focus' | 'shortBreak' | 'longBreak', minutes: number) => {
    setIsRunning(false);
    setMode(newMode);
    setDurationMinutes(minutes);
    setTimeLeft(minutes * 60);
    setSessionStart(null);
    setCurrentSessionId(null);
  };

  const handleStartTimer = async () => {
    if (!isRunning) {
      const startTime = sessionStart || new Date();
      setSessionStart(startTime);
      setIsRunning(true);

      // Create a focus session record in db if in focus mode and not yet created
      if (mode === 'focus' && userId && !currentSessionId) {
        try {
          const { data, error } = await supabase
            .from('focus_sessions')
            .insert([
              {
                user_id: userId,
                task_id: selectedTaskId || null,
                start_time: startTime.toISOString(),
                duration_minutes: durationMinutes,
                completed: false,
              }
            ])
            .select()
            .single();

          if (!error && data) {
            setCurrentSessionId(data.id);
          }
        } catch (err) {
          console.error('Failed to initialize session:', err);
        }
      }
    }
  };

  const handlePauseTimer = () => {
    setIsRunning(false);
  };

  const handleResetTimer = () => {
    setIsRunning(false);
    setTimeLeft(durationMinutes * 60);
    setSessionStart(null);
    setCurrentSessionId(null);
  };

  const handleCompleteSession = async () => {
    if (mode === 'focus' && userId) {
      try {
        if (currentSessionId) {
          await supabase
            .from('focus_sessions')
            .update({
              end_time: new Date().toISOString(),
              completed: true,
              duration_minutes: durationMinutes,
            })
            .eq('id', currentSessionId);
        } else {
          await supabase.from('focus_sessions').insert([
            {
              user_id: userId,
              task_id: selectedTaskId || null,
              start_time: sessionStart ? sessionStart.toISOString() : new Date(Date.now() - durationMinutes * 60000).toISOString(),
              end_time: new Date().toISOString(),
              duration_minutes: durationMinutes,
              completed: true,
            }
          ]);
        }
        alert(`🌟 Great job! You successfully completed your ${durationMinutes}m focus session!`);
        loadData();
      } catch (err) {
        console.error('Failed to save session:', err);
      }
    }
    // Switch to short break
    handleModeChange('shortBreak', 5);
  };

  // Log distraction
  const handleLogDistraction = async (tag: string, note?: string) => {
    if (!userId) return;
    try {
      // Find or create session ID
      let sid = currentSessionId;
      if (!sid && sessions.length > 0) {
        sid = sessions[0].id;
      }
      if (!sid) {
        // Create a quick placeholder session to associate with
        const { data } = await supabase
          .from('focus_sessions')
          .insert([
            {
              user_id: userId,
              start_time: new Date().toISOString(),
              duration_minutes: durationMinutes,
              completed: false,
            }
          ])
          .select()
          .single();
        if (data) sid = data.id;
      }

      if (sid) {
        await supabase.from('distractions').insert([
          {
            user_id: userId,
            session_id: sid,
            tag,
            note: note || null,
          }
        ]);
        loadData();
      }
    } catch (err) {
      console.error('Failed to log distraction:', err);
    }
  };

  // Formatting helpers
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const totalSeconds = durationMinutes * 60;
  const progressPercent = totalSeconds > 0 ? ((totalSeconds - timeLeft) / totalSeconds) * 100 : 0;
  const totalFocusHours = (sessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0) / 60).toFixed(1);

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Focus Tracker</h1>
          <p className="text-slate-500 mt-1">
            Master your attention with the Pomodoro technique and track study distractions.
          </p>
        </div>

        {/* Quick summary badges */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold">
            <Flame className="w-4 h-4 text-amber-500" />
            <span>{totalFocusHours} hrs focused</span>
          </div>
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{sessions.filter(s => s.completed).length} completed</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Main Timer Display (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm flex flex-col items-center">
          {/* Mode Selector Tabs */}
          <div className="flex items-center p-1.5 bg-slate-100/80 rounded-2xl gap-1">
            <button
              onClick={() => handleModeChange('focus', 25)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs md:text-sm font-semibold transition-all ${
                mode === 'focus'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Flame className="w-4 h-4 text-amber-500" />
              Focus (25m)
            </button>
            <button
              onClick={() => handleModeChange('shortBreak', 5)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs md:text-sm font-semibold transition-all ${
                mode === 'shortBreak'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Coffee className="w-4 h-4 text-emerald-500" />
              Short Break (5m)
            </button>
            <button
              onClick={() => handleModeChange('longBreak', 15)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs md:text-sm font-semibold transition-all ${
                mode === 'longBreak'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-4 h-4 text-blue-500" />
              Long Break (15m)
            </button>
          </div>

          {/* Big Circular Progress Timer */}
          <div className="relative w-64 h-64 md:w-80 md:h-80 my-8 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="42"
                className="stroke-slate-100"
                strokeWidth="5"
                fill="transparent"
              />
              <circle
                cx="50"
                cy="50"
                r="42"
                className={`${
                  mode === 'focus'
                    ? 'stroke-indigo-600'
                    : mode === 'shortBreak'
                    ? 'stroke-emerald-500'
                    : 'stroke-blue-500'
                } transition-all duration-300`}
                strokeWidth="5"
                strokeDasharray={2 * Math.PI * 42}
                strokeDashoffset={2 * Math.PI * 42 * (1 - progressPercent / 100)}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>

            <div className="absolute flex flex-col items-center">
              <span className="text-5xl md:text-6xl font-black text-slate-900 font-mono tracking-tight">
                {formatTime(timeLeft)}
              </span>
              <span className="mt-2 text-xs md:text-sm font-semibold text-slate-400 capitalize flex items-center gap-1.5">
                {mode === 'focus' ? 'Deep Work Session' : mode === 'shortBreak' ? 'Rest & Recharge' : 'Long Rest'}
              </span>
            </div>
          </div>

          {/* Task Linker */}
          {mode === 'focus' && (
            <div className="w-full max-w-md mb-6">
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                Focus on specific task (optional):
              </label>
              <select
                value={selectedTaskId}
                onChange={(e) => setSelectedTaskId(e.target.value)}
                className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- General Study Session --</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title} {task.subject ? `(${task.subject})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleResetTimer}
              className="p-3.5 rounded-2xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              title="Reset Timer"
            >
              <RotateCcw className="w-6 h-6" />
            </button>

            {isRunning ? (
              <button
                onClick={handlePauseTimer}
                className="flex items-center gap-2.5 px-8 py-4 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-2xl shadow-lg shadow-amber-500/20 transition-all active:scale-95 text-base"
              >
                <Pause className="w-5 h-5 fill-current" />
                Pause
              </button>
            ) : (
              <button
                onClick={handleStartTimer}
                className="flex items-center gap-2.5 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/25 transition-all active:scale-95 text-base"
              >
                <Play className="w-5 h-5 fill-current" />
                Start Focus
              </button>
            )}

            <button
              onClick={handleCompleteSession}
              className="p-3.5 rounded-2xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
              title="Mark Completed"
            >
              <Check className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Right Column: Distractions & Past Sessions (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Distraction Logger Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
            <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Distraction Logger</h3>
                <p className="text-xs text-slate-400">Did you get sidetracked? Log it to improve awareness.</p>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-xs font-semibold text-slate-500 mb-2">Quick 1-click tags:</p>
              <div className="flex flex-wrap gap-2">
                {distractionTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => handleLogDistraction(tag)}
                    className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 font-medium transition-colors"
                  >
                    + {tag}
                  </button>
                ))}
              </div>

              {/* Custom distraction note */}
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  placeholder="Other distraction..."
                  value={customDistraction}
                  onChange={(e) => setCustomDistraction(e.target.value)}
                  className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-400"
                />
                <button
                  onClick={() => {
                    if (customDistraction.trim()) {
                      handleLogDistraction(customDistraction.trim());
                      setCustomDistraction('');
                    }
                  }}
                  className="px-3 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800"
                >
                  Log
                </button>
              </div>
            </div>

            {/* Recent Distractions */}
            {distractions.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-100">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Logged today ({distractions.length})
                </span>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {distractions.slice(0, 6).map((d) => (
                    <span
                      key={d.id}
                      className="text-[11px] bg-rose-50 text-rose-700 border border-rose-100 px-2 py-0.5 rounded-lg font-medium"
                    >
                      {d.tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Session History Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
              <History className="w-4 h-4 text-slate-500" />
              <h3 className="font-bold text-slate-900 text-sm">Session History</h3>
            </div>

            <div className="mt-4 space-y-3 max-h-72 overflow-y-auto pr-1">
              {sessions.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">
                  No sessions recorded yet. Start studying to build your history!
                </div>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-[11px]">
                        {session.duration_minutes || 25}m
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">
                          {session.completed ? 'Completed Session' : 'Partial Session'}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {new Date(session.start_time).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}{' '}
                          at{' '}
                          {new Date(session.start_time).toLocaleTimeString(undefined, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`font-semibold px-2 py-0.5 rounded-full text-[10px] ${
                        session.completed
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {session.completed ? 'Finished' : 'Incomplete'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
