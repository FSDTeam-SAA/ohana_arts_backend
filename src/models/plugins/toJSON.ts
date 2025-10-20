import type { Schema } from "mongoose";
/**
 * Adds a clean toJSON that:
 *  - exposes `id` instead of `_id`
 *  - removes `__v` and `passwordHash` if present
 *  - keeps virtuals
 */
export const toJSON = (schema: Schema) => {
  schema.set("toJSON", {
    virtuals: true,
    versionKey: false,
    transform: (_doc: any, ret: any) => {
      ret.id = ret._id.toString();
      delete ret._id;
      if (typeof ret.passwordHash !== "undefined") delete ret.passwordHash;
      return ret;
    },
  });
};
