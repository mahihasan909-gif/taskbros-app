import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";
import {
  ensureNotificationPermission,
  notifyRoutineChanged,
  notifyTaskDone,
  registerPushToken,
} from "../lib/notifications";
import type { Profile, Room, RoomJoinRequest, RoomMember, UserRole } from "../types/db";

type MemberWithProfile = RoomMember & { profile: Profile };

type RoomContextValue = {
  loading: boolean;
  profile: Profile | null;
  room: Room | null;
  members: MemberWithProfile[];
  myRole: UserRole | null;
  pendingRequest: RoomJoinRequest | null;
  pendingRoomName: string | null;
  refresh: () => Promise<void>;
};

const RoomContext = createContext<RoomContextValue>({
  loading: true,
  profile: null,
  room: null,
  members: [],
  myRole: null,
  pendingRequest: null,
  pendingRoomName: null,
  refresh: async () => {},
});

export function RoomProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [pendingRequest, setPendingRequest] = useState<RoomJoinRequest | null>(null);
  const [pendingRoomName, setPendingRoomName] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.user) {
      setProfile(null);
      setRoom(null);
      setMembers([]);
      setPendingRequest(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle();
    setProfile(profileData ?? null);

    const { data: membership } = await supabase
      .from("room_members")
      .select("room_id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (!membership) {
      setRoom(null);
      setMembers([]);

      const { data: request } = await supabase
        .from("room_join_requests")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("status", "pending")
        .maybeSingle();
      setPendingRequest((request as RoomJoinRequest) ?? null);

      if (request) {
        const { data: pendingRoom } = await supabase
          .from("rooms")
          .select("name")
          .eq("id", (request as RoomJoinRequest).room_id)
          .maybeSingle();
        setPendingRoomName(pendingRoom?.name ?? null);
      } else {
        setPendingRoomName(null);
      }

      setLoading(false);
      return;
    }

    setPendingRequest(null);
    setPendingRoomName(null);

    const { data: roomData } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", membership.room_id)
      .maybeSingle();
    setRoom(roomData ?? null);

    const { data: memberRows } = await supabase
      .from("room_members")
      .select("*, profile:profiles(*)")
      .eq("room_id", membership.room_id);
    setMembers((memberRows as unknown as MemberWithProfile[]) ?? []);

    setLoading(false);
  }, [session?.user]);

  useEffect(() => {
    load();
  }, [load]);

  const myRole = useMemo<UserRole | null>(() => {
    if (!session?.user) return null;
    return members.find((m) => m.user_id === session.user.id)?.role ?? null;
  }, [members, session?.user]);

  useEffect(() => {
    if (!session?.user) return;
    ensureNotificationPermission().then((granted) => {
      if (granted) registerPushToken(session.user.id);
    });
  }, [session?.user]);

  useEffect(() => {
    if (!room || myRole !== "leader") return;

    const channel = supabase
      .channel(`room-${room.id}-task-done`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "task_assignments", filter: `room_id=eq.${room.id}` },
        (payload) => {
          const oldRow = payload.old as { status?: string };
          const newRow = payload.new as { status: string; assigned_to: string; task_title: string };
          if (newRow.status === "done" && oldRow.status !== "done") {
            const name = members.find((m) => m.user_id === newRow.assigned_to)?.profile.full_name ?? "Someone";
            notifyTaskDone(name, newRow.task_title);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room, myRole, members]);

  useEffect(() => {
    if (!room || myRole !== "leader" || members.length === 0) return;

    const memberIds = new Set(members.map((m) => m.user_id));

    const channel = supabase
      .channel(`room-${room.id}-routine-changes`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "routine_slots" },
        (payload) => {
          const row = (payload.new ?? payload.old) as { user_id?: string } | null;
          if (!row?.user_id || !memberIds.has(row.user_id)) return;
          const name = members.find((m) => m.user_id === row.user_id)?.profile.full_name ?? "Someone";
          notifyRoutineChanged(name);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room, myRole, members]);

  const value = useMemo(
    () => ({ loading, profile, room, members, myRole, pendingRequest, pendingRoomName, refresh: load }),
    [loading, profile, room, members, myRole, pendingRequest, pendingRoomName, load]
  );

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoom() {
  return useContext(RoomContext);
}
