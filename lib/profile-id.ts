export async function profilePublicId(userId:string){
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(`yunamatch-profile:${userId}`));
  return [...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,"0")).join("").slice(0,32);
}

export async function resolveProfilePublicId(
  userIds: Iterable<string>,
  publicId: string,
) {
  for (const userId of userIds) {
    if ((await profilePublicId(userId)) === publicId) return userId;
  }
  return null;
}
