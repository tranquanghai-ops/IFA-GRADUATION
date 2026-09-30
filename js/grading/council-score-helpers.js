export function getCouncilMemberScorerId(member) {
  if (!member) return '';
  const email = String(member.memberEmail || member.email || '').toLowerCase().trim();
  return (member.type === 'guest' || member.isExternalGuest || (email && !email.endsWith('@tdtu.edu.vn')))
    ? email || member.memberId || ''
    : member.memberId || email || member.memberName || '';
}

export function getCouncilMemberSlots(council, activity) {
  return Array.isArray(council?.memberSlots)
    ? council.memberSlots
    : (activity?.councilStructure?.slots || []);
}
