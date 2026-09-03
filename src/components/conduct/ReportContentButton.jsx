/**
 * Member “Report” control. Opens the Conduct report form.
 */

import { useState } from 'react';
import { Flag } from 'lucide-react';
import Button from '../ui/Buttons';
import Modal from '../ui/Modal';
import ConductReportForm from './ConductReportForm';
import { supabase } from '../../lib/supabase';

export default function ReportContentButton({
  contentType,
  contentId = null,
  targetUserId = null,
  projectId = null,
  contentPath = '',
  label = 'Report',
  className = '',
  size = 'sm',
}) {
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(true);

  const onOpen = async () => {
    const { data } = await supabase.auth.getSession();
    if (!data?.session?.user) {
      setSignedIn(false);
      setOpen(true);
      return;
    }
    setSignedIn(true);
    setOpen(true);
  };

  return (
    <>
      <Button
        type="button"
        size={size}
        variant="ghost"
        className={`gap-1 text-text-muted ${className}`}
        onClick={() => void onOpen()}
      >
        <Flag className="w-3.5 h-3.5" />
        {label}
      </Button>
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Report to staff"
        size="md"
      >
        {signedIn ? (
          <ConductReportForm
            contentType={contentType}
            contentId={contentId}
            targetUserId={targetUserId}
            projectId={projectId}
            contentPath={contentPath}
            lockType
            onDone={() => setOpen(false)}
            onCancel={() => setOpen(false)}
          />
        ) : (
          <p className="text-sm text-text-secondary">
            Sign in to send a private report to staff.
          </p>
        )}
      </Modal>
    </>
  );
}
