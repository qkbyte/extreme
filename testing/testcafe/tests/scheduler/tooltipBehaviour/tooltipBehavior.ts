import { safeSizeTest } from '../../../helpers/safeSizeTest';
import dataSource from './init/widget.data';
import { createScheduler, scroll } from './init/widget.setup';
import url from '../../../helpers/getPageUrl';
import Scheduler from '../../../model/scheduler';

fixture`Appointment tooltip behavior during scrolling in the Scheduler (T755449)`
  .page(url(__dirname, '../../container.html'));

safeSizeTest('The tooltip of collector should not scroll page and immediately hide', async (t) => {
  const scheduler = new Scheduler('#container');

  await t
    .click(scheduler.collectors.find('7').element, { speed: 0.2 })
    .expect(scheduler.appointmentTooltip.isVisible())
    .ok();
}, [600, 450]).before(async () => createScheduler({
  views: [{
    type: 'week',
    name: 'week',
    maxAppointmentsPerCell: '0',
  }],
  currentDate: new Date(2017, 4, 25),
  startDayHour: 9,
  currentView: 'week',
  dataSource: [{
    text: 'A',
    startDate: new Date(2017, 4, 22, 9, 30),
    endDate: new Date(2017, 4, 22, 11, 30),
  }, {
    text: 'B',
    startDate: new Date(2017, 4, 22, 9, 30),
    endDate: new Date(2017, 4, 22, 11, 30),
  }, {
    text: 'C',
    startDate: new Date(2017, 4, 22, 9, 30),
    endDate: new Date(2017, 4, 22, 11, 30),
  }, {
    text: 'D',
    startDate: new Date(2017, 4, 22, 9, 30),
    endDate: new Date(2017, 4, 22, 11, 30),
  }, {
    text: 'E',
    startDate: new Date(2017, 4, 22, 9, 30),
    endDate: new Date(2017, 4, 22, 11, 30),
  }, {
    text: 'F',
    startDate: new Date(2017, 4, 22, 9, 30),
    endDate: new Date(2017, 4, 22, 11, 30),
  }, {
    text: 'G',
    startDate: new Date(2017, 4, 22, 9, 30),
    endDate: new Date(2017, 4, 22, 11, 30),
  }],
}));

safeSizeTest('The tooltip should not hide after automatic scrolling during an appointment click', async (t) => {
  const scheduler = new Scheduler('#container');
  const appointment = scheduler.getAppointment('Brochure Design Review');

  await t
    .click(appointment.element, { speed: 0.2 })
    .expect(scheduler.appointmentTooltip.isVisible())
    .ok();
}, [600, 400]).before(async () => createScheduler({
  views: ['week'],
  currentView: 'week',
  dataSource,
}));

safeSizeTest('The tooltip should hide after manually scrolling in the browser', async (t) => {
  const scheduler = new Scheduler('#container');
  const appointment = scheduler.getAppointment('Brochure Design Review');

  await t
    .click(appointment.element, { speed: 0.2 })
    .expect(scheduler.appointmentTooltip.isVisible())
    .ok();
  await scroll(0, 100);
  await t
    .wait(500)
    .expect(scheduler.appointmentTooltip.isVisible()).notOk();
}, [600, 400]).before(async () => createScheduler({
  views: ['week'],
  currentView: 'week',
  dataSource,
}));
