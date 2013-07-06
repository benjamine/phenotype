Phenotype
=========

> "A phenotype (from Greek phainein, 'to show' + typos, 'type') is the composite of an organism's observable characteristics or traits" -- [Wikipedia](http://en.wikipedia.org/wiki/Phenotype)

Phenotype is a modern typing system for Javascript based on **["Traits"][1]**.

The main idea behind Traits is taking [SRP](http://en.wikipedia.org/wiki/Single_responsibility_principle) to the typing system by decoupling:

- The object type hierarchy (inheritance and polimorphism); and
- Behavior definition (composable units of **reusable** behavior)

A *Trait* is, on its simplest form, a set of methods (behavior). They provide the ultimate reusability of multiple inheritance, but without all the feared sloppyness (eg. unexpected/uncontrolled overrides, and the famous [diamond problem](http://en.wikipedia.org/wiki/Diamond_problem#The_diamond_problem)).

Phenotype traits extend the typical definition of *Trait*, to use them as the only type artifact (instead of traits being just a complement for classes).

This makes them simpler to use, and better matches the [prototypal nature of Javascript](http://javascript.crockford.com/prototypal.html).

Installation
------------

``` sh
npm install phenotype
```

Introductory Examples
--------------------

``` js

    var Trait = phenotype.Trait;

    var Walker = new Trait('Walker', {
        goTo: function(location) {
            phenotype.pending();
        }
    });

    var Swimmer = new Trait('Swimmer', {
        goTo: function(location) {
            phenotype.pending();
        }
    });

    var Flyer = new Trait('Flyer', {
        goTo: function(location) {
            phenotype.pending();
        }
    });

    var Duck = new Trait('Duck', Walker, Swimmer, Flyer);
    try {
        Duck.create();
    } catch(err) {
        // conflict, goTo is defined in Walker, Swimmer and Flyer
        console.error(err);
    }

    // updating

    var jet = Flyer.create();

    // add a trait to existing object
    var Vehicle = new Trait('Vehicle', { seats: 3 });
    Vehicle.addTo(jet);

    // logs 3
    console.log(jet.seats);

    // modify existing Trait
    Vehicle.add({ seats: 4, wings: 2 }, new Trait({ pilot: true }));

    // logs 4 2 true
    console.log(jet.seats, jet.wings, jet.pilot);

    // using "required"

    var Retriever = new Trait('Retriever', {
        goTo: phenotype.member.required,
        grab: phenotype.member.required,
        retrieve: function(thing) {
            this.goTo(thing.location);
            this.grab(thing);
            this.goTo(this.previousLocation);
        }
    });

    try {
        var retriever = Retriever.create();
    } catch(err) {
        // goTo is required by Retriever, this is an abstract Trait
        console.error(err);
    }

    var Dog = new Trait('Dog', Walker, Retriever, {
        grab: function(thing) {
            phenotype.pending();
        }
    });

    var dog = Dog.create();

    try {
        var ball = {};
        dog.retrieve(ball);
    } catch(err) {
        // throws "pending" error from grab method above
        console.error(err);
    }

    // using mixin (allows to apply a Trait to a preexistent object)

    var parrot = { name: 'pepe' };

    try {
        Retriever.mixin(parrot);
    } catch(err) {
        // goTo is required by Retriever, and parrot doesn't have it
        console.log(err);
    }

    parrot.goTo = phenotype.pending;
    parrot.grab = phenotype.pending;
    // this time parrot provides all required methods
    Retriever.mixin(parrot);

    // using "aliasOf" and "from"

    var Bird = new Trait('Bird', Walker, Flyer, {
        walkTo: phenotype.member.aliasOf(Walker, 'goTo'),
        goTo: phenotype.member.from(Flyer)
    });

    var Hawk = new Trait('Hawk', Bird, Retriever, {
        grab: function(thing) {
            phenotype.pending();
        }
    });

    var Capibara = new Trait('Capibara', Walker, Swimmer, {
        walkTo: phenotype.member.aliasOf(Walker, 'goTo'),
        swimTo: phenotype.member.aliasOf(Swimmer, 'goTo'),
        goTo: function(location) {
            location.isOnWater() ? this.swimTo(location) : this.walkTo(location);
        }
    });

    // using ancestors

    var Electric = new Trait('Electric', {
        shutdown: function() {
            console.log('disconnected power');
        }
    });

    var CombustionEngine = new Trait('CombustionEngine', {
        shutdown: function() {
            console.log('disconnected fuel injection');
        }
    });

    var Car = new Trait('Car', Electric, CombustionEngine, {
        open: function(all){
            console.log('doors unlocked');
        },
        shutdown: phenotype.member.ancestors().then(function() {
            console.log('doors locked');
        })
    });

    var RetractableRoof = new Trait('RetractableRoof', {
        openRoof: function() {
            console.log('roof retracted');
        },
        shutdown: function() {
            console.log('roof extended');
        }
    });

    var ConvertibleCar = new Trait('ConvertibleCar', Car, RetractableRoof, {
        open: phenotype.member.ancestors().wrap(function(inner, base){
            return function(all){
                inner.call(this, all);
                if (all) {
                    this.openRoof();
                }
            }
        }),
        shutdown: phenotype.member.ancestors()
    });

    // using pipe and async

    var Peeler = new Trait('Peeler', {
        process: function(err, thing) {
            console.log('peeling ' + thing);
            // peeling takes time, but timeout at 1500ms
            var async = phenotype.async(1500);
            setTimeout(function(){
                async.done('peeled ' + thing);
            }, 1000);
            return async;
        }
    });

    Peeler.create().process(null, "apple").then(function(err, result){
        if (err) {
            console.error('error peeling apple');
            return;
        }
        // logs "peeled apple"
        console.log('result:', result);
    });

    var Chopper = new Trait('Chopper', {
        process: function(err, thing) {
            console.log('chopping ' + thing);
            return 'chopped ' + thing;
        }
    });

    var Mixer = new Trait('Mixer', {
        process: function(err, thing) {
            console.log('mixing ' + thing);
            // mixing takes time
            var async = phenotype.async(3000);
            setTimeout(function(){
                async.done('mixed ' + thing);
            }, 1200);
            return async;
        }
    });

    var Oven = new Trait('Oven', {
        process: function(err, thing) {
            console.log('baking ' + thing);
            return 'baked ' + thing;
        }
    });

    var CookingMachine = new Trait('CookingMachine', Peeler, Chopper, Mixer, Oven, {
        process: phenotype.member.ancestors().pipe({continueOnError: true})
        .then(function(err, thing) {
            if (err) {
                console.error('cooking failed');
                console.error(err);
                return;
            }
            console.log('finished cooking:', thing);
            return thing;
        })
    });

    var machine = CookingMachine.create();

    machine.process(null, "vegetables").then(function(err, result){
        if (err) {
            console.error('error, no result');
            return;
        }
        // logs "result: baked mixed chopped peeled vegetables"
        console.log('result:', result);
    });

    // properties & events

    var Labrador = new Trait('Labrador', Dog, Retriever, phenotype.HasEvents, {
        name: phenotype.member.property(),        
        initial: phenotype.member.property(function(){
            return this.name().substr(0, 1).toUpperCase();
        }),
    });

    var spike = Labrador.create();
    spike.name('Spike');

    // logs "Spike"
    console.log(spike.name());
    // logs "S"
    console.log(spike.initial());

    spike.on({
        bark: function(e, volume) {
            console.log(e.source.name(), 'barked', volume);
        },
        namechanged: function(e, data) {
            console.log(data.property.name, 'changed from', data.previousValue, 'to', data.value);
        },
        initialchanged: function(e, data) {
            console.log(data.property.name, 'changed from', data.previousValue, 'to', data.value);
        }
    });

    // logs "Spikey barked loud"
    spike.emit('bark', 'loud');

    spike.off('bark');

    spike.emit('bark', 'louder');

    // logs "name changed from Spike to Spikey"
    spike.name('Spikey');


```

Dynamic Prototypes
-----------

If available, phenotype will make use of ES6 Proxies, making created objects to inherit members dinamically, making Trait inheritance as dynamic as native prototypal inheritance.

At the moment of this writing ES6 Proxies are available at:

- Chrome (using harmony flag)
- FF
- Node.js (using harmony flag)

If ES6 Proxies are not available, phenotype will fallback to using fixed prototypes, ie. objects won't have members added to Traits after the object creation. This can be forced using ```MyTrait.fixed()```.

License
--------

The MIT License (MIT)

Copyright (c) 2013 Benjamin Eidelman (@beneidel)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.


 [1]: https://en.wikipedia.org/wiki/Trait_(computer_programming)
