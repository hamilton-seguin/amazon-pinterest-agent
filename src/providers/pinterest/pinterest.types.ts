export interface CreatePinRequest {
  boardId: string
  title: string
  description: string
  link: string
  imageUrl: string
}

export interface CreatePinResult {
  pinId: string
}
