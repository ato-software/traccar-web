import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  IconButton,
  Table, TableBody, TableCell, TableHead, TableRow,
} from '@mui/material';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import LocationSearchingIcon from '@mui/icons-material/LocationSearching';
import {
  formatDistance, formatVolume, formatTime, formatNumericHours,
} from '../common/util/formatter';
import ReportFilter from './components/ReportFilter';
import { useAttributePreference } from '../common/util/preferences';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import ReportsMenu from './components/ReportsMenu';
import ColumnSelect from './components/ColumnSelect';
import usePersistedState from '../common/util/usePersistedState';
import { useCatch } from '../reactHelper';
import useReportStyles from './common/useReportStyles';
import MapPositions from '../map/MapPositions';
import MapView from '../map/core/MapView';
import MapCamera from '../map/MapCamera';
import AddressValue from '../common/components/AddressValue';
import TableShimmer from '../common/components/TableShimmer';
import MapGeofence from '../map/MapGeofence';
import scheduleReport from './common/scheduleReport';
import MapScale from '../map/MapScale';
import fetchOrThrow from '../common/util/fetchOrThrow';

const columnsArray = [
  ['startTime', 'reportStartTime'],
  ['startOdometer', 'positionOdometer'],
  ['address', 'positionAddress'],
  ['endTime', 'reportEndTime'],
  ['duration', 'reportDuration'],
  ['engineHours', 'reportEngineHours'],
  ['spentFuel', 'reportSpentFuel'],
];
const columnsMap = new Map(columnsArray);

const StopReportPage = () => {
  const navigate = useNavigate();
  const { classes } = useReportStyles();
  const t = useTranslation();

  const devices = useSelector((state) => state.devices.items);

  const distanceUnit = useAttributePreference('distanceUnit');
  const volumeUnit = useAttributePreference('volumeUnit');

  const [columns, setColumns] = usePersistedState('stopColumns', ['startTime', 'endTime', 'startOdometer', 'address']);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const onShow = useCatch(async ({ deviceIds, groupIds, from, to }) => {
    setLoading(true);
    try {
      // Original UTC boundaries from parameters
      const originalFromUTC = new Date(from);
      const originalToUTC = new Date(to);
      
      // Offset for Asia/Karachi timezone (UTC+5)
      const offsetMs = 5 * 60 * 60 * 1000;
      
      // Convert UTC boundaries to Karachi local time to find day boundaries
      const startInKarachi = new Date(originalFromUTC.getTime() + offsetMs);
      const endInKarachi = new Date(originalToUTC.getTime() + offsetMs);
      
      // Build array of fetch promises for each day
      const fetchPromises = [];
      
      // Start from the first day in Karachi time
      const currentDate = new Date(startInKarachi);
      currentDate.setHours(0, 0, 0, 0); // Set to midnight Karachi time
      
      while (currentDate <= endInKarachi) {
        // Create day boundaries in Karachi local time
        const dayStartKarachi = new Date(currentDate);
        dayStartKarachi.setHours(0, 0, 0, 0);
        
        const dayEndKarachi = new Date(currentDate);
        dayEndKarachi.setHours(23, 59, 59, 999);
        
        // Convert Karachi boundaries to UTC
        const dayStartUTC = new Date(dayStartKarachi.getTime() - offsetMs);
        const dayEndUTC = new Date(dayEndKarachi.getTime() - offsetMs);
        
        // Clamp against original UTC boundaries
        const clampedStart = dayStartUTC < originalFromUTC ? originalFromUTC : dayStartUTC;
        const clampedEnd = dayEndUTC > originalToUTC ? originalToUTC : dayEndUTC;
        
        // Only fetch if the range is valid
        if (clampedStart <= clampedEnd) {
          // Build query for this day
          const query = new URLSearchParams({ 
            from: clampedStart.toISOString(), 
            to: clampedEnd.toISOString() 
          });
          deviceIds.forEach((deviceId) => query.append('deviceId', deviceId));
          groupIds.forEach((groupId) => query.append('groupId', groupId));
          
          // Add fetch promise to array
          fetchPromises.push(
            fetchOrThrow(`/api/reports/stops?${query.toString()}`, {
              headers: { Accept: 'application/json' },
            }).then(response => response.json())
          );
          
          // Stop if we've reached the original end date
          if (clampedEnd.getTime() >= originalToUTC.getTime()) {
            break;
          }
        }
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      // Execute all fetches in parallel
      const allDayResults = await Promise.all(fetchPromises);
      
      // Flatten all results into single array
      const allStops = allDayResults.flat();
      
      setItems(allStops);
    } finally {
      setLoading(false);
    }
  });

  const onExport = useCatch(async ({ deviceIds, groupIds, from, to }) => {
    const query = new URLSearchParams({ from, to });
    deviceIds.forEach((deviceId) => query.append('deviceId', deviceId));
    groupIds.forEach((groupId) => query.append('groupId', groupId));
    window.location.assign(`/api/reports/stops/xlsx?${query.toString()}`);
  });

  const onSchedule = useCatch(async (deviceIds, groupIds, report) => {
    report.type = 'stops';
    await scheduleReport(deviceIds, groupIds, report);
    navigate('/reports/scheduled');
  });

  const formatValue = (item, key) => {
    const value = item[key];
    switch (key) {
      case 'deviceId':
        return devices[value].name;
      case 'startTime':
      case 'endTime':
        return formatTime(value, 'minutes');
      case 'startOdometer':
        return formatDistance(value, distanceUnit, t);
      case 'duration':
        return formatNumericHours(value, t);
      case 'engineHours':
        return value > 0 ? formatNumericHours(value, t) : null;
      case 'spentFuel':
        return value > 0 ? formatVolume(value, volumeUnit, t) : null;
      case 'address':
        return (<AddressValue latitude={item.latitude} longitude={item.longitude} originalAddress={value} />);
      default:
        return value;
    }
  };

  return (
    <PageLayout menu={<ReportsMenu />} breadcrumbs={['reportTitle', 'reportStops']}>
      <div className={classes.container}>
        {selectedItem && (
          <div className={classes.containerMap}>
            <MapView>
              <MapGeofence />
              <MapPositions
                positions={[{
                  deviceId: selectedItem.deviceId,
                  fixTime: selectedItem.startTime,
                  latitude: selectedItem.latitude,
                  longitude: selectedItem.longitude,
                }]}
                titleField="fixTime"
              />
            </MapView>
            <MapScale />
            <MapCamera latitude={selectedItem.latitude} longitude={selectedItem.longitude} />
          </div>
        )}
        <div className={classes.containerMain}>
          <div className={classes.header}>
            <ReportFilter onShow={onShow} onExport={onExport} onSchedule={onSchedule} deviceType="multiple" loading={loading}>
              <ColumnSelect columns={columns} setColumns={setColumns} columnsArray={columnsArray} />
            </ReportFilter>
          </div>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell className={classes.columnAction} />
                <TableCell>{t('sharedDevice')}</TableCell>
                {columns.map((key) => (<TableCell key={key}>{t(columnsMap.get(key))}</TableCell>))}
              </TableRow>
            </TableHead>
            <TableBody>
              {!loading ? items.map((item) => (
                <TableRow key={item.positionId}>
                  <TableCell className={classes.columnAction} padding="none">
                    {selectedItem === item ? (
                      <IconButton size="small" onClick={() => setSelectedItem(null)}>
                        <GpsFixedIcon fontSize="small" />
                      </IconButton>
                    ) : (
                      <IconButton size="small" onClick={() => setSelectedItem(item)}>
                        <LocationSearchingIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                  <TableCell>{devices[item.deviceId].name}</TableCell>
                  {columns.map((key) => (
                    <TableCell key={key}>
                      {formatValue(item, key)}
                    </TableCell>
                  ))}
                </TableRow>
              )) : (<TableShimmer columns={columns.length + 2} startAction />)}
            </TableBody>
          </Table>
        </div>
      </div>
    </PageLayout>
  );
};

export default StopReportPage;
