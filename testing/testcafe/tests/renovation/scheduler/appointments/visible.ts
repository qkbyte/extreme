import { createScreenshotsComparer } from 'devextreme-screenshot-comparer';
import Scheduler from '../../../../model/scheduler';
import { multiPlatformTest, createWidget } from '../../../../helpers/multi-platform-test';

const test = multiPlatformTest({
  page: 'declaration/scheduler',
  platforms: ['jquery', 'react'],
});

// NOTE RENOVATION TESTCAFE: All these test scenarios have analogs in jQuery's testcafe tests.
fixture.skip('Layout:Appointments:visible');

[1, 0].forEach((maxAppointmentsPerCell) => {
  [true, false, undefined].forEach((visible) => {
    test(`Appointments should be filtered by visible property(visible='${visible}', maxAppointmentsPerCell='${maxAppointmentsPerCell}'`, async (t, { screenshotComparerOptions }) => {
      const scheduler = new Scheduler('#container');
      const { takeScreenshot, compareResults } = createScreenshotsComparer(t);

      await t
        .expect(await takeScreenshot(`filtering-visible=${visible}-maxAppointmentsPerCell=${maxAppointmentsPerCell}.png`, scheduler.workSpace, screenshotComparerOptions))
        .ok()

        .expect(compareResults.isValid())
        .ok(compareResults.errorMessages());
    }).before(async (_, { platform }) => {
      await createWidget(platform, 'dxScheduler', {
        dataSource: [{
          text: 'Recurrence app',
          roomId: [1],
          startDate: new Date(2021, 3, 13, 1, 30),
          endDate: new Date(2021, 3, 13, 2, 30),
          recurrenceRule: 'FREQ=DAILY',
          visible,
        }, {
          text: 'Simple app',
          roomId: [1],
          startDate: new Date(2021, 3, 12, 3),
          endDate: new Date(2021, 3, 12, 4),
          visible,
        }],
        views: [{
          type: 'week',
          name: 'Numeric Mode',
          maxAppointmentsPerCell,
        }],
        currentView: 'Numeric Mode',
        currentDate: new Date(2021, 3, 15),
        height: 600,
      });
    });
  });
});
