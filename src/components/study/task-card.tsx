import { Task, Status } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { Edit2, Trash2, Calendar, AlertCircle } from 'lucide-react';

export function TaskCard({ 
  task, 
  onEdit, 
  onDelete,
  onStatusChange 
}: { 
  task: Task, 
  onEdit: () => void, 
  onDelete: () => void,
  onStatusChange: () => void
}) {
  const supabase = createClient();
  
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'Completed';

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    await supabase.from('tasks').update({ status: e.target.value as Status }).eq('id', task.id);
    onStatusChange();
  };

  return (
    <div className={`p-4 bg-white rounded-xl border transition-shadow ${isOverdue ? 'border-red-300 shadow-[0_0_10px_rgba(239,68,68,0.1)]' : 'border-slate-200 hover:shadow-sm'}`}>
      <div className="flex justify-between items-start mb-2">
        <h3 className={`font-semibold ${isOverdue ? 'text-red-700' : 'text-slate-900'}`}>{task.title}</h3>
        <div className="flex gap-1">
          <button onClick={onEdit} className="p-1.5 text-slate-400 hover:text-blue-600 rounded-md hover:bg-blue-50 transition-colors">
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={onDelete} className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {task.subject && (
        <span className="inline-block px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-md font-medium mb-3">
          {task.subject}
        </span>
      )}
      
      {task.description && (
        <p className="text-sm text-slate-500 mb-4 line-clamp-2">{task.description}</p>
      )}
      
      <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-slate-100">
        <div className="flex items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-1.5">
            <Calendar className={`w-4 h-4 ${isOverdue ? 'text-red-500' : 'text-slate-400'}`} />
            <span className={isOverdue ? 'text-red-600' : 'text-slate-500'}>
              {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No date'}
            </span>
          </div>
          
          <div className={`px-2 py-1 rounded-md ${
            task.priority === 'High' ? 'bg-red-50 text-red-700' :
            task.priority === 'Medium' ? 'bg-orange-50 text-orange-700' :
            'bg-green-50 text-green-700'
          }`}>
            {task.priority}
          </div>
        </div>
        
        <select 
          value={task.status} 
          onChange={handleStatusChange}
          className={`text-sm w-full py-1.5 px-2 rounded-lg border outline-none font-medium ${
            task.status === 'Completed' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
            task.status === 'In Progress' ? 'bg-blue-50 border-blue-200 text-blue-700' :
            'bg-slate-50 border-slate-200 text-slate-600'
          }`}
        >
          <option value="Not Started">Not Started</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
        </select>
      </div>
      
      {isOverdue && (
        <div className="mt-3 flex items-center gap-1 text-xs font-bold text-red-600">
          <AlertCircle className="w-4 h-4" />
          OVERDUE
        </div>
      )}
    </div>
  );
}
