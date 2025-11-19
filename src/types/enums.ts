export enum Badge {
  Bronze = "Bronze",
  Silver = "Silver",
  Gold = "Gold",
  Emerald = "Emerald",
  Sapphire = "Sapphire",
  Ruby = "Ruby", // <-- This was 'Roby' in your original, I've kept it as Ruby from our last fix
  Amethyst = "Amethyst",
  Diamond = "Diamond",
  PinkDiamond = "Pink Diamond",
  GalaxyOpal = "Galaxy Opal",
  DarkMatter = "Dark Matter",
}

export enum RSVPStatus {
  Yes = "Yes",
  Maybe = "Maybe",
  No = "No",
  Pending = "Pending",
}

export enum CheckInStatus {
  HomeSafe = "HomeSafe",
  StillOut = "StillOut",
  EnRoute = "EnRoute",
}

export enum RideStatus {
  Active = "Active",
  Completed = "Completed",
  Cancelled = "Cancelled",
}

export enum PassengerStatus {
  Requested = "Requested",
  Accepted = "Accepted",
  PickedUp = "PickedUp",
  DroppedOff = "DroppedOff",
  Rejected = "Rejected",
}

export enum PaymentStatus {
  Pending = "Pending",
  Paid = "Paid",
  Failed = "Failed",
}

export enum PaymentMethod {
  Stripe = "Stripe",
  PayPal = "PayPal",
}

export enum NotificationType {
  Invite = "Invite",
  RSVP = "RSVP",
  ChatMessage = "ChatMessage",
  Payment = "Payment",
  RideUpdate = "RideUpdate",
  CheckIn = "CheckIn",
  Points = "points",
  Task = "Task", // <-- 1. ADD THIS NEW TYPE
  EventStarting = "EventStarting", // <-- 2. ADD THIS FOR THE SCHEDULER
}
