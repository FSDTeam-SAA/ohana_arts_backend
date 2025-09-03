export enum Badge {
  Bronze = "Bronze",
  Silver = "Silver",
  Gold = "Gold",
  Emerald = "Emerald",
}

export enum RSVPStatus {
  Yes = "Yes",
  Maybe = "Maybe",
  No = "No",
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
}
