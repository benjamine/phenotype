Phenotype
=========

> "A phenotype (from Greek phainein, 'to show' + typos, 'type') is the composite of an organism's observable characteristics or traits" -- [Wikipedia](http://en.wikipedia.org/wiki/Phenotype)

Phenotype is a modern typing system for Javascript, it's based on **["Traits"](https://en.wikipedia.org/wiki/Trait_(computer_programming))** as they exist in other programming languages (like Scala, Smalltalk or PHP).

The main idea behind Traits is taking [SRP](http://en.wikipedia.org/wiki/Single_responsibility_principle) to the typing system by decoupling:

- The object type hierarchy (inheritance and polimorphism)
- Behavior definition (composable units of **reusable** behavior)

A *Trait* is, on it's simplest form, a set of methods (behavior). They provide the ultimate reusability of multiple inheritance, but without all the feared sloppyness (eg. unexpected/uncontrolled overrides, [the diamond problem](http://en.wikipedia.org/wiki/Diamond_problem#The_diamond_problem)).

Phenotype traits extend the typical definition of *Trait*, to use them as the only type artifact (instead of traits being just a complement for classes).

This makes them simpler to use, and better matches the [prototypal nature of Javascript](http://javascript.crockford.com/prototypal.html).

Introductory Examples
--------------------

``` js

    var Walker = new phenotype.Trait('Walker', {
        goTo: function(location) {
            phenotype.pending();
        }
    });

    var Swimmer = new phenotype.Trait('Swimmer', {
        goTo: function(location) {
            phenotype.pending();
        }
    });

    var Flyer = new phenotype.Trait('Flyer', {
        goTo: function(location) {
            phenotype.pending();
        }
    });

    var Duck = new phenotype.Trait('Duck', Walker, Swimmer, Flyer);
    try {
        Duck.create();
    } catch(err) {
        // conflict, goTo is defined in Walker, Swimmer and Flyer
        console.log(err);
    }

    // using "required"

    var Retriever = new phenotype.Trait('Retriever', {
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
        console.log(err);
    }

    var Dog = new phenotype.Trait('Dog', Walker, Retriever, {
        grab: function(thing) {
            phenotype.pending();
        }
    });

    var dog = Dog.create();

    try {
        dog.retrieve(ball);
    } catch(err) {
        // throws "pending" error from grab method above
        console.log(err);
    }

    // using "aliasOf" and "from"

    var Bird = new phenotype.Trait('Bird', Walker, Flyer, {
        walkTo: phenotype.member.aliasOf(Walker, 'goTo'),
        goTo: phenotype.member.from(Flyer)
    });

    var Hawk = new phenotype.Trait('Hawk', Bird, Retriever {
        grab: function(thing) {
            phenotype.pending();
        }
    });

    var Capibara = new phenotype.Trait('Capibara', Walker, Swimmer, {
        walkTo: phenotype.member.aliasOf(Walker, 'goTo'),
        swimTo: phenotype.member.aliasOf(Swimmer, 'goTo'),
        goTo: function(location) {
            location.isOnWater() ? this.swimTo(location) : this.walkTo(location);
        }
    });

    // using ancestors

    var Electric = new phenotype.Trait('Electric', {
        shutdown: function() {
            console.log('disconnected power');
        }
    });

    var CombustionEngine = new phenotype.Trait('CombustionEngine', {
        shutdown: function() {
            console.log('disconnected fuel injection');
        }
    });

    var Car = new phenotype.Trait('Car', Electric, CombustionEngine, {
        open: function(all){
            console.log('doors unlocked');
        },
        shutdown: phenotype.member.ancestors().then(function() {
            console.log('doors locked');
        })
    });

    var RetractableRoof = new phenotype.Trait('RetractableRoof', {
        openRoof: function() {
            console.log('roof retracted');
        },
        shutdown: function() {
            console.log('roof extended');
        }
    });

    var ConvertibleCar = new phenotype.Trait('ConvertibleCar', Car, RetractableRoof, {
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

    var Peeler = new phenotype.Trait('Peeler', {
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

    var Chopper = new phenotype.Trait('Chopper', {
        process: function(err, thing) {
            console.log('chopping ' + thing);
            return 'chopped ' + thing;
        }
    });

    var Mixer = new phenotype.Trait('Mixer', {
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

    var Oven = new phenotype.Trait('Oven', {
        process: function(err, thing) {
            console.log('baking ' + thing);
            return 'baked ' + thing;
        }
    });

    var CookingMachine = new phenotype.Trait('CookingMachine', Peeler, Chopper, Mixer, Oven, {
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