export interface ISong {
  author: string;
  title: string;
  lyrics: string;
  tags?: SongTags[];
}

export enum SongTags {
  alabanza = 'alabanza',
  adoracion = 'adoracion',
}
