/**
 * Global “Report a concern” modal — opened from footer / Contact only.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import Modal from '../components/ui/Modal';
import ReportConcernForm from '../components/report/ReportConcernForm';

const ReportConcernContext = createContext(null);

export function ReportConcernProvider({ children }) {
  const [open, setOpen] = useState(false);

  const openReportConcern = useCallback(() => setOpen(true), []);
  const closeReportConcern = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({ openReportConcern, closeReportConcern, isOpen: open }),
    [openReportConcern, closeReportConcern, open]
  );

  return (
    <ReportConcernContext.Provider value={value}>
      {children}
      <Modal
        isOpen={open}
        onClose={closeReportConcern}
        title="Report a concern"
        size="lg"
      >
        <ReportConcernForm
          key={open ? 'open' : 'closed'}
          onDone={closeReportConcern}
          onCancel={closeReportConcern}
        />
      </Modal>
    </ReportConcernContext.Provider>
  );
}

export function useReportConcern() {
  const ctx = useContext(ReportConcernContext);
  if (!ctx) {
    throw new Error('useReportConcern must be used within ReportConcernProvider');
  }
  return ctx;
}

export default ReportConcernContext;
