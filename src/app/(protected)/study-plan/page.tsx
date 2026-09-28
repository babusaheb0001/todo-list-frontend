'use client';

import { useState, useEffect, useCallback } from 'react';
import { Task } from '@/lib/types';
import { TaskCard } from '@/components/study/task-card';
import { TaskForm } from '@/components/study/task-form';
import { Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// createClient is safe to call at module level in client components that are
// rendered exclusively in the browser (after hydration). The '(protected)'
// layout only renders authenticated users, so SSR here is minimal.
const supabase = createClient();

export default function StudyPlanPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('tasks')
      .select('id, user_id, title, subject, description, due_date, priority, status, created_at')
      .eq('user_id', user.id)
      .order('due_date', { ascending: true, nullsFirst: false });

    if (!error && data) setTasks(data as Task[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    await supabase.from('tasks').delete().eq('id', id);
    fetchTasks();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Study Plan</h1>
          <p className="text-slate-500">Manage your tasks and upcoming deadlines.</p>
        </div>
        <button
          onClick={() => { setEditingTask(null); setIsFormOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Task
        </button>
      </div>

      {isFormOpen && (
        <TaskForm
          task={editingTask}
          onClose={() => setIsFormOpen(false)}
          onSuccess={fetchTasks}
        />
      )}

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-slate-200 rounded-xl"></div>
          <div className="h-24 bg-slate-200 rounded-xl"></div>
          <div className="h-24 bg-slate-200 rounded-xl"></div>
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <p className="text-slate-600 font-medium">No study tasks yet.</p>
          <p className="text-sm text-slate-400 mt-1">Create your first task and start planning your study day.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={() => { setEditingTask(task); setIsFormOpen(true); }}
              onDelete={() => handleDelete(task.id)}
              onStatusChange={fetchTasks}
            />
          ))}
        </div>
      )}
    </div>
  );
}
