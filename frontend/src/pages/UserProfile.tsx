import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, Loader2, Save, UserCircle } from "lucide-react";
import { useKeycloak } from "@react-keycloak/web";

import { request } from "../api";
import type { UserProfile, UserProfileResponse, UserProfileUpdate } from "../types";

type TokenProfile = {
  sub?: string;
  email?: string;
  preferred_username?: string;
  username?: string;
  given_name?: string;
  family_name?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  phone_number?: string;
  email_verified?: boolean;
  emailVerified?: boolean;
  enabled?: boolean;
  createdTimestamp?: number;
  attributes?: Record<string, unknown>;
};

function tokenProfile(tokenParsed: unknown): TokenProfile {
  return (tokenParsed ?? {}) as TokenProfile;
}

function profileFromToken(profile: TokenProfile): UserProfile {
  return {
    sub: profile.sub ?? "",
    username: profile.username ?? profile.preferred_username ?? "",
    email: profile.email ?? "",
    firstName: profile.firstName ?? profile.given_name ?? "",
    lastName: profile.lastName ?? profile.family_name ?? "",
    phone: profile.phone ?? profile.phone_number ?? "",
    enabled: profile.enabled ?? true,
    emailVerified: profile.emailVerified ?? profile.email_verified ?? false,
    createdTimestamp: profile.createdTimestamp ?? 0,
    createdAt: new Date().toISOString(),
    attributes: profile.attributes ?? {},
  };
}

function displayDate(value?: string) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString("vi-VN");
}

export default function UserProfilePage() {
  const { keycloak } = useKeycloak();
  const token = useMemo(() => tokenProfile(keycloak?.tokenParsed), [keycloak?.tokenParsed]);

  const [profile, setProfile] = useState<UserProfile>(() => profileFromToken(token));
  const [exists, setExists] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      setInitialLoading(true);
      setError(null);
      setSavedMessage(null);

      try {
        const response = await request<UserProfileResponse>("GET", "/v1/users/me");
        if (cancelled) return;

        if (response?.data) {
          setExists(response.data.exists);
          setProfile({
            ...profileFromToken(token),
            ...response.data.user,
          });
        } else {
          setExists(false);
          setProfile(profileFromToken(token));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Khong the tai ho so tai khoan.");
        }
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    };

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
    setSavedMessage(null);
  };

  const validate = () => {
    if (!profile.firstName.trim() || !profile.lastName.trim()) {
      return "First name and last name are required.";
    }
    return null;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationMessage = validate();
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setSaving(true);
    setError(null);
    setSavedMessage(null);

    try {
      const payload: UserProfileUpdate = {
        firstName: profile.firstName.trim(),
        lastName: profile.lastName.trim(),
        phone: profile.phone?.trim() || null,
      };

      const response = await request<UserProfile, UserProfileUpdate>(
        "PUT",
        "/v1/users/me",
        undefined,
        undefined,
        payload
      );

      if (!response?.data) {
        throw new Error("Failed to save user profile");
      }

      setProfile(response.data);
      setExists(true);
      setSavedMessage("Profile saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save user profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">User profile</h2>
          <p className="text-sm text-slate-600">Account information and contact details.</p>
        </div>
        <div
          className={`inline-flex w-fit items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
            exists
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {exists ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {exists ? "Profile saved" : "Update required"}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-200 p-5">
          <UserCircle className="h-5 w-5 text-slate-600" />
          <div>
            <h3 className="font-bold text-slate-900">Account details</h3>
            <p className="text-sm text-slate-500">{profile.email || profile.username || "Authenticated user"}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {savedMessage && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              {savedMessage}
            </div>
          )}

          {initialLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Keycloak ID</span>
                <input
                  value={profile.sub}
                  disabled
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Username</span>
                <input
                  value={profile.username}
                  disabled
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                />
              </label>

              <label className="space-y-1 md:col-span-2">
                <span className="text-sm font-medium text-slate-700">Email</span>
                <input
                  value={profile.email}
                  disabled
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">First name</span>
                <input
                  name="firstName"
                  value={profile.firstName}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Last name</span>
                <input
                  name="lastName"
                  value={profile.lastName}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Phone</span>
                <input
                  name="phone"
                  value={profile.phone ?? ""}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Created at</span>
                <input
                  value={displayDate(profile.createdAt)}
                  disabled
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                />
              </label>
            </div>
          )}

          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={initialLoading || saving}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving..." : exists ? "Update profile" : "Create profile"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
