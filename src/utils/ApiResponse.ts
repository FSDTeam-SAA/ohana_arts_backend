export type ApiMeta = { page?: number; pageSize?: number; total?: number };

export function ok<T>(data: T, message = "OK", meta?: ApiMeta) {
  return { success: true, message, data, meta };
}
export function created<T>(data: T, message = "Created") {
  return { success: true, message, data };
}
export function fail(message = "Error", details?: any) {
  return { success: false, message, details };
}
