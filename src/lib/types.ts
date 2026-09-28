export type Priority = 'Low' | 'Medium' | 'High';
export type Status = 'Not Started' | 'In Progress' | 'Completed';

export interface Task {
  id: string;
  user_id: string;
  title: string;
  subject: string | null;
  description: string | null;
  due_date: string | null;
  priority: Priority;
  status: Status;
  created_at: string;
}

export interface FocusSession {
  id: string;
  user_id: string;
  task_id: string | null;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  completed: boolean;
  created_at: string;
}

export interface Distraction {
  id: string;
  user_id: string;
  session_id: string;
  tag: string;
  note: string | null;
  created_at: string;
}

export type ExpenseCategory = 'Food' | 'Transport' | 'Books' | 'Rent' | 'Entertainment' | 'Other';

export interface Expense {
  id: string;
  user_id: string;
  amount: number;
  category: ExpenseCategory;
  description: string | null;
  date: string;
  created_at: string;
}

export interface Budget {
  id: string;
  user_id: string;
  month: number;
  year: number;
  budget_amount: number;
}
