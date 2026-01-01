export function mapBackendUser(user: any) {
  return {
    id: user._id,
    email: user.email,
    phone: user.phone,
    displayName: user.displayName,
    gender: user.gender,
    profileImage: user.profileImage,
    points: user.points,
  };
}
