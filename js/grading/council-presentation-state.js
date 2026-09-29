export function getNextCouncilPresentation(assignments, councilId) {
  const ordered = (assignments || [])
    .filter(assignment => assignment.councilId === councilId)
    .sort((left, right) => (left.order || 0) - (right.order || 0));
  const currentIndex = ordered.findIndex(assignment => assignment.presentationStatus === 'presenting');
  if (currentIndex < 0) return { current: null, next: null };
  return {
    current: ordered[currentIndex],
    next: ordered.slice(currentIndex + 1).find(assignment => assignment.presentationStatus !== 'presented') || null
  };
}
