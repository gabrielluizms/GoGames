/**
 * Utilitários para manipulação segura de datas
 */

export const formatDateToYYYYMMDD = (date) => {
  if (!date) return '';
  
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    return '';
  }
};

export const parseDateString = (dateString) => {
  if (!dateString) return null;
  
  try {
    const [year, month, day] = dateString.split('-').map(Number);
    if (!year || !month || !day) return null;
    
    const date = new Date(year, month - 1, day);
    if (isNaN(date.getTime())) return null;
    
    return date;
  } catch (error) {
    return null;
  }
};

export const isSameDay = (date1, date2) => {
  if (!date1 || !date2) return false;
  
  try {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  } catch (error) {
    return false;
  }
};

export const createEventDatesArray = (events) => {
  if (!Array.isArray(events)) return [];
  
  return events
    .map(event => {
      if (!event || !event.date) return null;
      return parseDateString(event.date);
    })
    .filter(date => date !== null);
};
