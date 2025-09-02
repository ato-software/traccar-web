import { useState } from 'react';
import {
  IconButton, Tooltip, Dialog, DialogTitle, DialogContent,
  DialogContentText, DialogActions, Button, Snackbar, Alert,
} from '@mui/material';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import { useTranslation } from '../common/components/LocalizationProvider';

const EngineToggleButton = ({ deviceId, deviceName, ignitionOn, onCommandSent }) => {
  const t = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const handleToggleClick = (e) => {
    e.stopPropagation();
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    setConfirmOpen(false);
    setLoading(true);

    const commandType = ignitionOn ? 'engineStop' : 'engineResume';

    try {
      const response = await fetch('/api/commands/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: commandType,
          attributes: {},
          deviceId: deviceId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Command failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      setSnackbar({
        open: true,
        message: ignitionOn ? t('commandEngineStopSuccess') : t('commandEngineStartSuccess'),
        severity: 'success'
      });

      if (onCommandSent) {
        onCommandSent(data);
      }
    } catch (error) {
      console.error('Error sending engine command:', error);
      setSnackbar({
        open: true,
        message: t('commandFailed'),
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setConfirmOpen(false);
  };

  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  return (
    <>
      <Tooltip title={ignitionOn ? t('commandEngineStop') : t('commandEngineStart')}>
        <span>
          <IconButton 
            size="small" 
            onClick={handleToggleClick}
            disabled={loading}
          >
            <PowerSettingsNewIcon
              fontSize="small"
              style={{ color: ignitionOn ? '#f44336' : '#4caf50' }}
            />
          </IconButton>
        </span>
      </Tooltip>

      <Dialog
        open={confirmOpen}
        onClose={handleCancel}
        onClick={(e) => e.stopPropagation()}
      >
        <DialogTitle>
          {ignitionOn ? t('commandEngineStop') : t('commandEngineStart')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {ignitionOn 
              ? t('confirmEngineStop').replace('{device}', deviceName || `Device ${deviceId}`)
              : t('confirmEngineStart').replace('{device}', deviceName || `Device ${deviceId}`)
            }
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancel} color="primary">
            {t('sharedCancel')}
          </Button>
          <Button 
            onClick={handleConfirm} 
            variant="contained"
            autoFocus
            sx={ignitionOn ? { 
              backgroundColor: '#f44336',
              color: '#ffffff',
              '&:hover': { 
                backgroundColor: '#d32f2f',
                color: '#ffffff'
              }
            } : { 
              backgroundColor: '#4caf50', 
              color: '#ffffff',
              '&:hover': { 
                backgroundColor: '#45a049',
                color: '#ffffff'
              } 
            }}
          >
            {ignitionOn ? t('commandEngineStop') : t('commandEngineStart')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default EngineToggleButton;
