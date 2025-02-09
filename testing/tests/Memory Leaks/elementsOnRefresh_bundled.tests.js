const $ = require('jquery');
const GoogleProvider = require('ui/map/provider.dynamic.google');
const memoryLeaksHelper = require('../../helpers/memoryLeaksHelper.js');

require('bundles/modules/parts/widgets-web');

GoogleProvider.remapConstant('http://fakeUrl');

QUnit.module('elementsOnRefresh', {
    beforeEach: function() {
        this.clock = sinon.useFakeTimers();
    },
    afterEach: function() {
        this.clock.restore();
    }
});

$.each(DevExpress.ui, function(componentName) {
    if($.fn[componentName] && memoryLeaksHelper.componentCanBeTriviallyInstantiated(componentName)) {
        QUnit.test(componentName + ' should not leak memory by creating redundant dom elements after refreshing', function(assert) {
            const testNode = memoryLeaksHelper.createTestNode();
            const component = $(testNode)[componentName](memoryLeaksHelper.getComponentOptions(componentName))[componentName]('instance');

            this.clock.tick(0);
            const originalDomElements = memoryLeaksHelper.getAllPossibleEventTargets();

            component._refresh();

            this.clock.tick(0);
            const newDomElements = memoryLeaksHelper.getAllPossibleEventTargets();
            if(newDomElements.length === originalDomElements.length) {
                assert.ok(true, 'After an option changes and causes re-rendering, no additional dom elements must be created');
            } else {
                assert.ok(false, memoryLeaksHelper.compareDomElements(originalDomElements, newDomElements));
            }
            memoryLeaksHelper.destroyTestNode(testNode);
            this.clock.tick(100);
        });
    }
});
