import { model, Schema } from 'mongoose';
import {
  ISong,
  SongTags,
} from '../interfaces/song-interface';

const songSchema = new Schema<ISong>(
  {
    title: {
      type: String,
      required: true,
      lowercase: true,
    },
    author: {
      type: String,
      required: true,
      lowercase: true,
    },
    lyrics: { type: String, required: true },
    tags: [
      {
        type: String,
        enum: Object.values(SongTags),
        default: [],
      },
    ],
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

songSchema.index({ title: 1, author: 1 });
songSchema.index({ tags: 1 });

export const SongModel = model<ISong>('Song', songSchema);
