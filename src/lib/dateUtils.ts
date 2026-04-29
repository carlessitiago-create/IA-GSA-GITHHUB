import { formatInTimeZone } from 'date-fns-tz';

const TIMEZONE = 'America/Sao_Paulo';

export const formatDate = (date: any) => {
  if (!date) return '-';
  let d: Date;
  
  if (typeof date.toDate === 'function') {
    d = date.toDate();
  } else {
    d = new Date(date);
  }

  if (isNaN(d.getTime())) return '-';
  return formatInTimeZone(d, TIMEZONE, 'dd/MM/yyyy');
};

export const formatDateTime = (date: any) => {
  if (!date) return '-';
  let d: Date;

  if (typeof date.toDate === 'function') {
    d = date.toDate();
  } else {
    d = new Date(date);
  }

  if (isNaN(d.getTime())) return '-';
  return formatInTimeZone(d, TIMEZONE, 'dd/MM/yyyy HH:mm');
};
