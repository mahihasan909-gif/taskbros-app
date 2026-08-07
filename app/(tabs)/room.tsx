import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { ScreenContainer } from "../../components/ui/ScreenContainer";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { useRoom } from "../../contexts/RoomContext";
import type { Profile, RoomJoinRequest } from "../../types/db";

type RequestWithProfile = RoomJoinRequest & { profile: Profile };

export default function Room() {
  const { session } = useAuth();
  const { loading, room, members, myRole, pendingRequest, pendingRoomName, refresh } = useRoom();
  const [copied, setCopied] = useState(false);
  const [requests, setRequests] = useState<RequestWithProfile[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [leavingOrDeleting, setLeavingOrDeleting] = useState(false);

  const loadRequests = useCallback(async () => {
    if (!room || myRole !== "leader") return;
    setRequestsLoading(true);
    const { data } = await supabase
      .from("room_join_requests")
      .select("*, profile:profiles(*)")
      .eq("room_id", room.id)
      .eq("status", "pending");
    setRequests((data as unknown as RequestWithProfile[]) ?? []);
    setRequestsLoading(false);
  }, [room, myRole]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  async function handleManualRefresh() {
    setRequestsLoading(true);
    await Promise.all([loadRequests(), refresh()]);
    setRequestsLoading(false);
  }

  async function copyCode() {
    if (!room) return;
    await Clipboard.setStringAsync(room.join_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleApprove(requestId: string) {
    setActingOn(requestId);
    await supabase.rpc("approve_join_request", { request_id: requestId });
    setActingOn(null);
    loadRequests();
    refresh();
  }

  async function handleReject(requestId: string) {
    setActingOn(requestId);
    await supabase.rpc("reject_join_request", { request_id: requestId });
    setActingOn(null);
    loadRequests();
  }

  function handleRemoveMember(userId: string, name: string) {
    Alert.alert("Remove member?", `${name} will lose access to this room.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setActingOn(userId);
          await supabase.rpc("remove_member", { target_user_id: userId });
          setActingOn(null);
          refresh();
        },
      },
    ]);
  }

  function handleLeaveRoom() {
    Alert.alert("Leave this room?", "You'll need a new invite code to rejoin.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: async () => {
          setLeavingOrDeleting(true);
          await supabase.rpc("leave_room");
          setLeavingOrDeleting(false);
          await refresh();
        },
      },
    ]);
  }

  function handleDeleteRoom() {
    Alert.alert(
      "Delete this room?",
      "This permanently removes the room, all members, and the whole schedule. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete room",
          style: "destructive",
          onPress: async () => {
            setLeavingOrDeleting(true);
            await supabase.rpc("delete_room");
            setLeavingOrDeleting(false);
            await refresh();
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <ScreenContainer scroll={false}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#6C5CE7" />
        </View>
      </ScreenContainer>
    );
  }

  if (pendingRequest) {
    return (
      <ScreenContainer>
        <View className="pt-4 pb-2">
          <Text className="text-text text-3xl font-extrabold">Room</Text>
        </View>
        <Card className="mt-4 items-center py-10">
          <Ionicons name="time-outline" size={40} color="#FFB020" />
          <Text className="text-text font-semibold mt-3">Waiting for approval</Text>
          <Text className="text-textMuted text-sm mt-1 text-center">
            Your request to join {pendingRoomName ?? "this room"} is pending. The
            room admin needs to approve you before you're in.
          </Text>
        </Card>
      </ScreenContainer>
    );
  }

  if (!room) {
    return (
      <ScreenContainer>
        <View className="pt-4 pb-2">
          <Text className="text-text text-3xl font-extrabold">Room</Text>
        </View>
        <Card className="mt-4 items-center py-10">
          <Ionicons name="people-circle-outline" size={40} color="#6C5CE7" />
          <Text className="text-text font-semibold mt-3">You're not in a room</Text>
          <Text className="text-textMuted text-sm mt-1 text-center mb-5">
            Create one as admin, or join with a code.
          </Text>
          <View className="w-full gap-3">
            <Button label="Create Room" onPress={() => router.push("/room/create")} />
            <Button label="Join Room" variant="outline" onPress={() => router.push("/room/join")} />
          </View>
        </Card>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View className="pt-4 pb-2 flex-row items-center gap-2">
        <Text className="text-text text-3xl font-extrabold flex-1">{room.name}</Text>
        {myRole === "leader" ? <Badge label="Admin" tone="primary" /> : null}
        <TouchableOpacity
          onPress={handleManualRefresh}
          disabled={requestsLoading}
          className="w-9 h-9 rounded-full bg-surface2 items-center justify-center"
        >
          {requestsLoading ? (
            <ActivityIndicator size="small" color="#6C5CE7" />
          ) : (
            <Ionicons name="refresh" size={18} color="#F2F2F7" />
          )}
        </TouchableOpacity>
      </View>
      <Text className="text-textMuted text-base -mt-1">
        {members.length} member{members.length === 1 ? "" : "s"}
      </Text>

      <Card className="mt-4 flex-row items-center justify-between">
        <View>
          <Text className="text-textMuted text-xs">Room code</Text>
          <Text className="text-text text-2xl font-extrabold tracking-widest mt-1">{room.join_code}</Text>
        </View>
        <View
          className="w-11 h-11 rounded-2xl bg-surface2 items-center justify-center"
          onTouchEnd={copyCode}
        >
          <Ionicons name={copied ? "checkmark" : "copy-outline"} size={20} color="#F2F2F7" />
        </View>
      </Card>

      {myRole === "leader" && !requestsLoading && requests.length > 0 ? (
        <>
          <Text className="text-text text-lg font-bold mt-6 mb-3">
            Join requests ({requests.length})
          </Text>
          {requests.map((r) => (
            <Card key={r.id} className="mb-3">
              <View className="flex-row items-center mb-3">
                <View className="w-10 h-10 rounded-full bg-surface2 items-center justify-center mr-3">
                  <Text className="text-text text-xs font-bold">{r.profile.full_name[0]}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-text font-semibold">{r.profile.full_name}</Text>
                  <Text className="text-textMuted text-xs mt-1">
                    {r.profile.person_type === "job_holder" ? "Job Holder" : "Student"}
                  </Text>
                </View>
              </View>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Button
                    label="Approve"
                    onPress={() => handleApprove(r.id)}
                    loading={actingOn === r.id}
                  />
                </View>
                <View className="flex-1">
                  <Button
                    label="Reject"
                    variant="outline"
                    onPress={() => handleReject(r.id)}
                    disabled={actingOn === r.id}
                  />
                </View>
              </View>
            </Card>
          ))}
        </>
      ) : null}

      <Text className="text-text text-lg font-bold mt-6 mb-3">Members</Text>
      {members.map((m) => (
        <Card key={m.user_id} className="mb-3 flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <View className="w-10 h-10 rounded-full bg-surface2 items-center justify-center mr-3">
              <Text className="text-text text-xs font-bold">{m.profile.full_name[0]}</Text>
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="text-text font-semibold">{m.profile.full_name}</Text>
                {m.role === "leader" ? <Badge label="Admin" tone="primary" /> : null}
              </View>
              <Text className="text-textMuted text-xs mt-1">
                {m.profile.person_type === "job_holder" ? "Job Holder" : "Student"}
              </Text>
            </View>
          </View>
          {myRole === "leader" && m.user_id !== session?.user.id ? (
            <Ionicons
              name="person-remove-outline"
              size={18}
              color="#FF5C72"
              onPress={() => handleRemoveMember(m.user_id, m.profile.full_name)}
            />
          ) : null}
        </Card>
      ))}

      <View className="mt-6">
        {myRole === "leader" ? (
          <TouchableOpacity
            onPress={handleDeleteRoom}
            disabled={leavingOrDeleting}
            className="border border-danger/40 rounded-2xl py-4 items-center"
          >
            <Text className="text-danger font-semibold">Delete room</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleLeaveRoom}
            disabled={leavingOrDeleting}
            className="border border-danger/40 rounded-2xl py-4 items-center"
          >
            <Text className="text-danger font-semibold">Leave room</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScreenContainer>
  );
}
