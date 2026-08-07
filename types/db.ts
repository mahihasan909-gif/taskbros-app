export type UserRole = "leader" | "member";
export type PersonType = "student" | "job_holder";

export type RoutineScanStatus = "none" | "processing" | "done" | "failed";

export type Profile = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  person_type: PersonType;
  routine_photo_url: string | null;
  routine_scan_status: RoutineScanStatus;
  created_at: string;
};

export type Room = {
  id: string;
  name: string;
  join_code: string;
  created_by: string;
  created_at: string;
};

export type RoomMember = {
  room_id: string;
  user_id: string;
  role: UserRole;
  joined_at: string;
};

export type JoinRequestStatus = "pending" | "approved" | "rejected";

export type RoomJoinRequest = {
  id: string;
  room_id: string;
  user_id: string;
  status: JoinRequestStatus;
  requested_at: string;
  decided_at: string | null;
};

export type Weekday =
  | "sun"
  | "mon"
  | "tue"
  | "wed"
  | "thu"
  | "fri"
  | "sat";

export type RoutineSlot = {
  id: string;
  user_id: string;
  day: Weekday;
  start_time: string; // "08:00"
  end_time: string; // "13:00"
  label: string; // "Class" | "Office" | "Free" ...
  is_busy: boolean;
};

export type TaskAssignment = {
  id: string;
  room_id: string;
  assigned_to: string;
  day: Weekday;
  date: string;
  task_title: string;
  task_note: string | null;
  time_slot: string | null;
  scheduled_time: string | null; // "HH:MM:SS"
  source: "ai" | "manual";
  status: "pending" | "done" | "skipped";
  recurring_task_id: string | null;
};

export type RecurringTask = {
  id: string;
  room_id: string;
  assigned_to: string;
  day: Weekday;
  task_title: string;
  time_slot: string | null;
  scheduled_time: string | null;
  active: boolean;
  created_by: string;
  created_at: string;
};
