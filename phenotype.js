'use strict';
var moduleFactory = function(exports) {

    var extend = function(target, source, recursive) {
        if (typeof source == 'object') {
            for (var name in source) {
                if (source.hasOwnProperty(name)) {
                    if (recursive && typeof target[name] === 'object' &&
                        typeof source[name] === 'object' &&
                        !(target instanceof Array) &&
                        !(source instanceof Array)) {
                        extend(target[name], source[name]);
                    } else {
                        target[name] = source[name];
                    }
                }
            }
        }
        return target;
    };

    var phenotype = exports;
    extend(phenotype, {
        version: '0.0.1',
        extend: extend,        
        conventions: {
            storageNamePrefix: '_',
            metaPropertyName: '__meta__'
        }
    });

    var conventions = phenotype.conventions;

    phenotype.noop = function noop(){};
    phenotype.pending = function pending(message) {
        var error = new Error(message || 'implementation is pending');
        error.pending = true;
        throw error;
    };

    // constants to use on trait definitions
    var member = phenotype.member = {};

    member.Conflict = function Conflict(memberName){
        // conflicting traits where this member has been defined
        this.sources = [];
        this.memberName = memberName;
    };

    member.Conflict.prototype.add = function(source, sourceMember) {
        this.sources.push({
            source: source,
            member: sourceMember
        });
        return this;
    };

    member.Conflict.prototype.getMessage = function() {
        var message = ['Unresolved conflict on member "', this.memberName, '"'];
        var sourceNames = [];
        for (var i = 0; i < this.sources.length; i++) {
            sourceNames.push(this.sources[i].source.name || '<self>');
        }
        if (sourceNames.length) {
            message.push(', sources: ', sourceNames.join(', '));
        }
        return message.join('');
    };

    var MultipleSources = function MultipleSources(){};

    member.multipleSources = new MultipleSources();

    member.Required = function Required(){
        // this member must be defined on another trait to create an object
    };

    member.Required.prototype.getMessage = function(memberName, trait) {
        var message = ['Required member not found'];
        if (memberName) {
            message.push(': "', memberName, '"');
        }
        if (trait && trait.name) {
            message.push(', required by "' + trait.name + '"');
        }
        return message.join('');
    };

    member.required = new member.Required();

    member.Combination = function Combination(options){
        var defaultOptions = {
            continueOnError: false,
            pipe: false,
            singleAncestor: false,
            recursive: true,
            ancestors: false
        };
        this.options = extend(defaultOptions, options);
    };

    var Async = phenotype.Async = function Async(timeout){
        this.isComplete = false;
        if (timeout) {
            this.timeout = timeout;
            var async = this;
            setTimeout(function(){
                if (!async.isComplete) {
                    var error = new Error('timeout');
                    error.timeout = timeout;
                    async.failed(error);
                }
            }, timeout);
        }
    };

    Async.prototype.complete = function(err, result) {
        if (this.isComplete) return;
        this.isComplete = true;
        if (this.listeners) {
            var length = this.listeners.length;
            for (var i = 0; i < length; i++) {
                this.listeners[i](err, result);
            }
        }
        if (typeof this.callback != 'function') return;
        return this.callback(err, result);
    };

    Async.prototype.done = function(result) {
        return this.complete(null, result);
    };

    Async.prototype.failed = function(err) {
        return this.complete(err);
    };

    Async.prototype.then = function() {
        Array.prototype.push.apply(this.listeners = this.listeners || [], arguments);
    };

    phenotype.async = function(timeout) {
        return new Async(timeout);
    };

    var combineSequence = function(sequence, options, memberName) {
        if (!sequence || !sequence.definitions || sequence.definitions.length === 0) {
            return phenotype.noop;
        }
        var definitions = sequence.definitions;
        var values = sequence.values = [];
        for (var i = 0; i < definitions.length; i++) {
            var definition = definitions[i];
            if (typeof definition.getValue == 'function') {
                values[i] = definition.getValue(memberName, sequence.sources[i]);
            } else {
                values[i] = definition;
            }
        }
        if (options.pipe) {
            return function pipeSequence(seedError, seedValue) {
                var index = 0, length = values.length;
                var asyncEnd, asyncCallback = function(err, result) {
                    index++;
                    pipeRun(err, result, true);
                };
                var pipeRun = function pipeRun(lastError, lastResult, continueOnError) {
                    while (index < length) {
                        try {
                            var value = values[index];
                            lastResult = value.apply(this, [lastError, lastResult]);
                            if (lastResult instanceof Async) {
                                lastResult.callback = asyncCallback;
                                if (!asyncEnd) {
                                    asyncEnd = new Async();
                                }
                                return asyncEnd;
                            }
                        } catch(err) {
                            lastError = err;
                            lastResult = null;
                            if (!continueOnError) {
                                throw err;
                            }
                        }
                        index++;
                    }
                    if (asyncEnd) {
                        asyncEnd.complete(lastError, lastResult);
                    }
                    return lastResult;
                };
                return pipeRun(seedError, seedValue, options.continueOnError);
            };
        } else {
            return function sequence() {
                var returnValue, length = values.length;
                for (var i = 0; i < length; i++) {
                    try {
                        returnValue = values[i].apply(this, arguments);
                    } catch(err) {
                        returnValue = null;
                        if (!options.continueOnError) {
                            throw err;
                        }
                    }
                }
                return returnValue;
            };
        }
    };

    member.Combination.prototype.getSequence = function(memberName, source) {
        // get all the definitions in order (the order depends on this.options)
        // each item of the array is either a definition (function and source Trait)
        // or another array (recursively)
        var sequence = { definitions: [], sources: [] };
        var options = this.options;
        var errorMessage;
        var error, i;

        if (options.ancestors) {

            var ancestorCount = 0;

            var ancestorTraits = [];
            if (source.traits instanceof Array) {
                ancestorTraits = source.traits;
            } else if (typeof source.traits == 'object') {
                for (var traitName in source.traits) {
                    if (source.traits.hasOwnProperty(traitName)) {
                        ancestorTraits.push(source.traits[traitName]);
                    }
                }
            }

            for (i = 0; i < ancestorTraits.length; i++) {
                var trait = ancestorTraits[i];
                var traitMeta = trait.meta();
                var definition = traitMeta.subject[memberName];
                if (definition) {
                    if (definition instanceof member.Conflict) {
                        if (options.recursive) {
                            // use all conflicting definitions
                            for (var j = 0; j < definition.sources.length; j++) {
                                sequence.definitions.push(definition.sources[j].member);
                                sequence.sources.push(definition.sources[j].source);
                                ancestorCount++;
                            }
                        } else {
                            error = new Error(definition.getMessage());
                            error.combinationAncestorsConflict = definition;
                            error.combination = this;
                            throw error;
                        }
                    } else if (definition instanceof member.Combination) {
                        // compose with ancestor combination
                        var ancestorSourceTrait = traitMeta.sourceOf[memberName];
                        var ancestorCombined = definition.getValue(memberName, ancestorSourceTrait);
                        sequence.definitions.push(ancestorCombined);
                        sequence.sources.push(ancestorSourceTrait);
                        ancestorCount++;
                    } else if (definition instanceof member.Required) {
                        // ignore
                    } else if (definition instanceof member.Property) {
                        error = new Error('properties cannot be combined. member: "' + memberName + '"');
                        error.combinationAncestorProperty = definition;
                        error.combination = this;
                        throw error;
                    } else {
                        sequence.definitions.push(definition);
                        sequence.sources.push(trait);
                        ancestorCount++;
                    }
                }
            }

            if (options.singleAncestor && ancestorCount > 1) {
                errorMessage = 'multiple ancestor definitions where found (single was expected). member: "' + memberName + '"';
                if (typeof source.name == 'string') {
                    errorMessage += ', at: "' + source.name + '"';
                }
                errorMessage += ', sources: ';
                for (i = 0; i < sequence.sources.length; i++) {
                    var ancestorSource = sequence.sources[i];
                    if (typeof ancestorSource.name == 'string')  {
                        errorMessage += ', "' + ancestorSource.name + '"';
                    }
                }
                error = new Error(errorMessage);
                error.combinationMultipleAncestors = sequence.sources;
                error.combination = this;
                throw error;
            }
        }

        if (options.wrap) {
            var wrapped = options.wrap(combineSequence(sequence, options, memberName), source.meta().base);
            if (typeof wrapped != 'function') {
                errorMessage = 'wrap must return a function. member: "' + memberName + '"';
                if (typeof source.name == 'string') {
                    errorMessage += ', at: "' + source.name + '"';
                }
                error = new Error(errorMessage);
                error.invalidWrap = options.wrap;
                error.combination = this;
                throw error;
            }
            sequence.definitions = [wrapped];
            sequence.sources = [source];
        }

        if (options.before) {
            sequence.definitions.unshift(options.before);
            sequence.sources.unshift(source);
        }
        if (options.then) {
            sequence.definitions.push(options.then);
            sequence.sources.push(source);
        }
        return sequence;
    };

    member.Combination.prototype.pipe = function() {
        this.options.pipe = true;
        return this;
    };

    member.Combination.prototype.then = function(value) {
        this.options.then = value;
        return this;
    };

    member.Combination.prototype.before = function(value) {
        this.options.before = value;
        return this;
    };

    member.Combination.prototype.wrap = function(wrapper) {
        this.options.wrap = wrapper;
        return this;
    };

    member.Combination.prototype.getValue = function(memberName, source) {
        return combineSequence(this.getSequence(memberName, source), this.options, memberName);
    };

    member.combination = function(options) {
        return new member.Combination(options);
    };

    member.ancestors = function(options) {
        var opt = options || {};
        opt.ancestors = true;
        return new member.Combination(opt);
    };

    member.ancestor = function(options) {
        var opt = options || {};
        opt.ancestors = true;
        opt.singleAncestor = true;
        return new member.Combination(opt);
    };

    member.From = function From(baseTrait) {
        // take this member from a specific trait, useful to solve conflicts
        this.baseTrait = baseTrait;
    };

    member.From.prototype.getValue = function(memberName, source) {
        return this.baseTrait.getMember(memberName);
    };

    member.from = function(baseTrait){
        return new member.From(baseTrait);
    };

    member.AliasOf = function AliasOf(baseTrait, memberName) {
        // take this member from a specific trait and different name, useful to solve conflicts
        this.baseTrait = baseTrait;
        this.memberName = memberName;
    };

    member.AliasOf.prototype.getValue = function(memberName, source) {
        return this.baseTrait.getMember(this.memberName);
    };

    member.aliasOf = function(baseTrait, memberName){
        return new member.AliasOf(baseTrait, memberName);
    };

    member.Property = function Property(options) {
        this.options = options;
    };

    member.Property.prototype.getValue = function(memberName, source){
        this.name = memberName;
        if (!this.storageName) {
            this.storageName = conventions.storageNamePrefix + memberName;
        }
        var property = this;
        return function(value) {
            if (typeof value == 'undefined') {
                return this[property.storageName];
            } else {
                var previousValue = this[property.storageName];
                if (previousValue !== value) {
                    this[property.storageName] = value;
                    if (typeof property.changed == 'function') {
                        property.changed({
                            property: property,
                            type: 'changed',
                            target: this,
                            previousValue: previousValue,
                            value: value
                        });
                    }
                }
                return value;
            }
        };
    };

    member.property = function(options) {
        return new member.Property(options);
    };

    var createNamedFunction = function(name) {
        // eval is evil, but is the only way to create a named function programmatically
        var evilEval = eval;
        return evilEval('(function ' + name + '(){})');
    };

    var Meta = phenotype.Meta = function Meta(subject) {
        this.subject = subject || {};
        this.subject[conventions.metaPropertyName] = this;
        this.sourceOf = {};
        this.originalNameOf = {};
        this.traits = {};
        var base = this.base = function metaBase(subject, name) {
            var args = Array.prototype.slice.apply(arguments).slice(2);
            return base[name].apply(subject, args);
        };
        this.baseSource = {};
    };

    Meta.of = function(subject) {
        if (typeof subject === 'object') {
            var meta = subject[conventions.metaPropertyName];
            if (meta instanceof Meta) {
                return meta;
            }
        }
    };

    var setMetaMember = function(meta, name, value, source, override) {
        var target = meta.subject;
        var currentValue = target[name];
        var resolveAfterSet = function() {

        };
        if (typeof currentValue == 'undefined' || currentValue instanceof member.Required) {
            // absent or required member is added
            target[name] = value;
            meta.sourceOf[name] = source;
            resolveAfterSet();
        } else if (value instanceof member.Required) {
            // required member is already present, ignore this
        } else {
            // member already exists
            if (override) {
                meta.base[name] = currentValue;
                meta.baseSource[name] = meta.sourceOf[name];
                target[name] = value;
                meta.sourceOf[name] = source;
                resolveAfterSet();
            } else if (target[name] === value) {
                // identic value, no conflict (eg. diamond inheritance)
            } else {
                // conflict
                if (!(currentValue instanceof member.Conflict)) {
                    target[name] = new member.Conflict(name).add(
                        meta.sourceOf[name],
                        currentValue
                    );
                    meta.sourceOf[name] = member.multipleSources;
                }
                target[name].add(source, value);
            }
        }
    };

    var copyMetaMembers = function(meta, from) {
        var source, members, override;
        if (from instanceof Meta) {
            // copying from a parent trait
            source = function(name) {
                return from.sourceOf[name];
            };
            members = from.subject;
        } else {
            source = from;
            override = true;
            if (from instanceof Trait) {
                // copying trait definition
                members = from.definition;
                meta.traits[from.name] = from;
            } else {
                // copying object definition
                members = from;
            }
        }

        for (var name in members) {
            if (members.hasOwnProperty(name) && name !== conventions.metaPropertyName) {
                var memberValue = members[name];
                var memberSource = typeof source == 'function' ? source(name) : source;
                setMetaMember(meta, name, memberValue, memberSource, override);
            }
        }
    };

    Meta.forTrait = function(trait) {
        var meta = new Meta();
        var traits = trait.traits;
        if (traits && traits.length) {
            var traitsLength = traits.length;
            for (var i = 0; i < traitsLength; i++) {
                copyMetaMembers(meta, traits[i].meta());
            }
        }
        if (trait.definition) {
            copyMetaMembers(meta, trait);
        }
        return meta;
    };

    Meta.forObject = function(traits, definition) {
        if (traits && traits.length === 1 && !definition) {
            return traits[0].meta();
        }
        var meta = new Meta();
        if (traits && traits.length) {
            var traitsLength = traits.length;
            for (var i = 0; i < traitsLength; i++) {
                copyMetaMembers(meta, traits[i].meta());
            }
        }
        if (definition) {
            copyMetaMembers(meta, definition);
        }
        return meta;
    };

    var metaResolveMember = function(meta, name) {
        var subject = meta.subject;
        if (subject.hasOwnProperty(name)) {
            var subjectMember = subject[name];
            var err;
            var source = meta.sourceOf[name];
            if (subjectMember instanceof member.Required) {
                err = new Error(subjectMember.getMessage(name, source));
                err.required = subjectMember;
                throw err;
            }
            if (subjectMember instanceof member.Conflict) {
                err = new Error(subjectMember.getMessage());
                err.conflict = subjectMember;
                throw err;
            }

            if (subjectMember instanceof member.Combination) {
                subject[name] = subjectMember.getValue(name, source);
                metaResolveMember(meta, name);
            } else if (subjectMember instanceof member.From) {
                subject[name] = subjectMember.getValue(name, source);
                meta.sourceOf[name] = subjectMember.baseTrait;
                metaResolveMember(meta, name);
            } else if (subjectMember instanceof member.AliasOf) {
                subject[name] = subjectMember.getValue(name, source);
                meta.sourceOf[name] = subjectMember.baseTrait;
                meta.originalNameOf[name] = subjectMember.memberName;
                metaResolveMember(meta, name);
            } else if (subjectMember instanceof member.Property) {
                subject[name] = subjectMember.getValue(name, source);
            }
        }
    };

    Meta.prototype.resolve = function() {
        // convert subject into a usable prototype
        // add default members
        var name;
        for (name in conventions.defaultMembers) {
            if (!this.definition || !this.definition[name]) {
                var value = conventions.defaultMembers[name];
                this.subject[name] = value;
                this.sourceOf[name] = conventions.defaultMembers;
            }
        }
        // validates prototype definition is complete
        for (name in this.subject) {
            metaResolveMember(this, name);
        }
        return this;
    };

    var anonymousTraits = 0;

    var Trait = phenotype.Trait = function Trait() {
        this.traits = [];
        for (var i = arguments.length - 1; i >= 0; i--) {
            var argument = arguments[i];
            if (typeof argument == 'object') {
                if (argument instanceof Trait) {
                    this.traits.unshift(argument);
                } else {
                    if (this.definition) {
                        throw new Error('multiple definition objects are not supported');
                    }
                    this.definition = argument;
                }
            } else {
                if (typeof argument == 'string' && i === 0) {
                    this.name = argument;
                } else {
                    throw new Error('Unexpected argument at index ' + i + ', type: ' + typeof argument);
                }
            }
        }
        if (!this.definition) {
            this.definition = {};
        }
        if (!this.name) {
            anonymousTraits++;
            this.name = 'Anonymous' + anonymousTraits;
        }
    };

    Trait.prototype.create = function(definition) {
        // create a prototype using only this trait, and optional definition
        return phenotype.create(this, definition);
    };

    Trait.prototype.getMember = function(name) {
        return this.meta().subject[name];
    };

    Trait.prototype.meta = function(){
        return Meta.forTrait(this);
    };

    Trait.prototype.fix = function() {
        var meta = this.meta().resolve();
        meta.fixed = true;
        this.fixed = createNamedFunction(this.name);
        this.fixed.prototype = meta.subject;
        return this;
    };

    Trait.prototype.unfix = function() {
        this.fixed = null;
        return this;
    };

    var createProxy = function(traits, definition) {

        var getProto = function() {
            return Meta.forObject(traits, definition).resolve().subject;
        };

        // run now to test prototype is valid
        getProto();

        // a simple forwarder proxy
        var handler = {
            getOwnPropertyDescriptor: function(name) {
                var desc = Object.getOwnPropertyDescriptor(getProto(), name);
                // a trapping proxy's properties must always be configurable
                if (desc !== undefined) { desc.configurable = true; }
                return desc;
            },
            getPropertyDescriptor: function(name) {
                var obj = getProto();
                while (obj) {
                    var desc = Object.getOwnPropertyDescriptor(obj, name);
                    if (desc) {
                        desc.configurable = true;
                        return desc;
                    }
                    obj = Object.getPrototypeOf(obj);
                }
            },
            getOwnPropertyNames: function() {
                var names = Object.getOwnPropertyNames(getProto());
                return names;
            },
            getPropertyNames: function() {
                var names = Object.getPropertyNames(getProto()); // not in ES5
                return names;
            },
            defineProperty: function(name, desc) {
                Object.defineProperty(getProto(), name, desc);
            },
            delete: function(name) {
                return delete getProto()[name];
            },
            fix: function() {
                if (Object.isFrozen(getProto())) {
                    var result = {};
                    Object.getOwnPropertyNames(getProto()).forEach(function(name) {
                        result[name] = Object.getOwnPropertyDescriptor(getProto(), name);
                    });
                return result;
                }
                // As long as getProto() is not frozen, the proxy won't allow itself to be fixed
                return undefined; // will cause a TypeError to be thrown
            },
            has: function(name) {
                return name in getProto();
            },
            hasOwn: function(name) {
                return ({}).hasOwnProperty.call(getProto(), name);
            },
            get: function(receiver, name) {
                return getProto()[name];
            },
            set: function(receiver, name, val) {
                getProto()[name] = val; return true;
            }, // bad behavior when set fails in non-strict mode
            enumerate: function() {
                var result = [];
                for (var name in getProto()) {
                    result.push(name);
                }
                return result;
            },
            keys: function() {
                var keys = Object.keys(getProto());
                return keys;
            }
        };

        return Proxy.create(handler);
    };

    phenotype.create = function() {
        var traits = [];
        var definition, i;
        for (i = arguments.length - 1; i >= 0; i--) {
            var argument = arguments[i];
            if (typeof argument == 'object') {
                if (argument instanceof Trait) {
                    traits.unshift(argument);
                } else {
                    if (definition) {
                        throw new Error('multiple definition objects are not supported');
                    }
                    definition = argument;
                }
            } else if (typeof argument != 'undefined') {
                throw new Error('Unexpected argument at index ' + i + ', type: ' + typeof argument);
            }
        }

        var ConstructorFunction;
        var traitsLength = traits.length;
        if ((!definition) && traitsLength === 1 && traits[0].fixed) {
            ConstructorFunction = traits[0].fixed;
        } else {
            var proto;
            var typeName = '';
            if (traitsLength < 1) {
                typeName = '_PhenotypeProto';
            } else {
                for (i = 0; i < traitsLength; i++) {
                    typeName += (i > 0 ? '_' : '') + traits[i].name;
                }
            }
            if (typeof window.Proxy == 'undefined' || typeof window.Proxy.create !== 'function') {
                // Proxy is not supported, use a fixed prototype
                var meta = Meta.forObject(traits, definition).resolve();
                meta.fixed = true;
                proto = meta.subject;
            } else {
                proto = createProxy(traits, definition);
            }
            ConstructorFunction = createNamedFunction(typeName);
            ConstructorFunction.prototype = proto;
        }

        return new ConstructorFunction();
    };
};
if (typeof require == 'undefined') {
    moduleFactory(window.phenotype = {});
} else if (typeof exports == 'undefined') {
    define('phenotype', ['exports'], moduleFactory);
} else {
    moduleFactory(exports);
}
