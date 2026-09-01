import { attendanceApi } from '../api';
import { useModalStore } from '../store/modalStore';
import i18n from '../i18n';

/**
 * Checks if today's attendance is marked for the current staff member.
 * If NOT marked, shows a blocking Alert prompting the staff member to mark attendance first.
 * Returns true if attendance is marked, false otherwise.
 */
export const verifyAttendanceMarked = async (navigation, actionTitle = 'perform this action') => {
  try {
    const res = await attendanceApi.myAttendance();
    const todayRecord = res.data?.today;

    // Attendance is marked if a record for today exists (PRESENT, LATE, HALF_DAY, LEAVE, or check_in_time set)
    const isMarked = !!(todayRecord && (todayRecord.status || todayRecord.check_in_time));

    if (!isMarked) {
      const title = i18n.t('attendance.not_marked_title', '⚠️ Attendance Not Marked!');
      const msg = i18n.t('attendance.not_marked_msg', { action: actionTitle, defaultValue: `You must mark your attendance for today before you can ${actionTitle}.\n\nPlease mark your attendance first to proceed.` });
      const btnText = i18n.t('attendance.mark_now', 'MARK ATTENDANCE NOW').toUpperCase();

      useModalStore.getState().showModal(
        title,
        msg,
        btnText,
        () => navigation.navigate('StaffAttendance', { fromDashboard: true })
      );
      return false;
    }
    return true;
  } catch (err) {
    console.log('[AttendanceGuard] Check failed or offline mode:', err.message);
    // In offline mode or on API error, allow the user to proceed
    return true;
  }
};
