export interface UserProfile {
  sub: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  enabled: boolean;
  emailVerified: boolean;
  createdTimestamp: number;
  createdAt: string;
  attributes: Record<string, unknown>;
}

export interface UserProfileResponse {
  exists: boolean;
  user: UserProfile;
}

export interface UserProfileUpdate {
  firstName: string;
  lastName: string;
  phone?: string | null;
}
