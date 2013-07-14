var moduleFactory = function(exports) {
    'use strict';

    var extend = function(target, source, options) {
        var opt = options || {};
        if (typeof source !== 'object') {
            return target;
        }
        for (var name in source) {
            if (source.hasOwnProperty(name)) {
                if (opt.recursive && typeof target[name] === 'object' &&
                    typeof source[name] === 'object' &&
                    !(target instanceof Array) &&
                    !(source instanceof Array)) {
                    extend(target[name], source[name], opt);
                } else {
                    if (opt.memberCopy) {
                        opt.memberCopy(target, source, name);
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
        version: '0.0.2',
        extend: extend,
        conventions: {
            storageNamePrefix: '_',
            metaPropertyName: '__meta__'
        }
    });

    var conventions = phenotype.conventions;

    var getErrorMethodName = function(error) {
        if (typeof error.stack === 'string') {
            var methodNameMatch;
            var lines = error.stack.split('\n');
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i];
                if (line.indexOf('Error: ') >= 0 || line.indexOf('.pending') >= 0 || line.indexOf('pending') === 0) {
                    if (!(methodNameMatch = /\[(as) ([^\]]+)\]/.exec(line))) {
                        continue;
                    }
                }
                methodNameMatch = /\[(as) ([^\]]+)\]/.exec(line) ||
                    /^(\s*at\s*)?[^\s]*\.([^\s\.]+)[\s\@]/.exec(line);
                if (methodNameMatch && methodNameMatch[2]) {
                    return methodNameMatch[2];
                }
                break;
            }
        }
    };

    phenotype.noop = function noop(){};
    phenotype.pending = function pending(message) {
        var error;
        if (message) {
            error = new Error(message);
        } else {
            error = new Error('implementation is pending');
        }

        // try to get caller method name from stack trace
        var methodName = getErrorMethodName(error);
        if (methodName) {
            if (!message) {
                error = new Error('implementation is pending, at method: "' + methodName + '"');
            }
            error.methodName = methodName;
        }

        error.pending = true;
        throw error;
    };

    phenotype.pending.message = function(msg) {
        return function(){
            return phenotype.pending(msg);
        };
    };

    phenotype.dynamic = (function(){
        /* global Proxy */
        return (typeof Proxy !== 'undefined' && typeof Proxy.create === 'function');
    })();

    phenotype.flatObject = function(obj) {
        if (typeof obj === 'object') {
            var flat = {};
            for (var name in obj) {
                if (name !== conventions.metaPropertyName) {
                    flat[name] = obj[name];
                }
            }
            return flat;
        }
        return obj;
    };

    var Event = phenotype.Event = function Event(type, args, source){
        if (typeof type !== 'string' || type.length < 1) {
            var error = new Error('invalid event type');
            error.invalidEventType = true;
            throw error;
        }
        this.type = type;
        if (args) {
            args.unshift(this);
            this.args = args;
        } else {
            this.args = [this];
        }
        this.source = source || null;
    };

    var eventEmitterCount = 0;

    var EventEmitter = phenotype.EventEmitter = function(source) {
        eventEmitterCount++;
        this.id = eventEmitterCount;
        this.source = source || this;
        this.propertyTrackers = {};
    };

    EventEmitter.of = function(source) {
        if (typeof source === 'object') {
            return source._eventEmitter;
        }
    };

    EventEmitter.prototype.getListeners = function(eventType, createIfNotExists) {
        var listeners = this.listeners;
        if (!listeners) {
            if (!createIfNotExists) { return; }
            listeners = this.listeners = {};
        }
        var eventListeners = listeners[eventType];
        if (!eventListeners) {
            if (!createIfNotExists) { return; }
            eventListeners = listeners[eventType] = [];
        }
        return eventListeners;
    };

    EventEmitter.prototype.on = function() {
        var eventType, listener;
        if (typeof arguments[0] === 'object') {
            var map = arguments[0];
            for (eventType in map) {
                if (map.hasOwnProperty(eventType)) {
                    this.on(eventType, map[eventType]);
                }
            }
            return this;
        } else {
            eventType = arguments[0];
            listener = arguments[1];
            var eventTypes;
            if (typeof eventType === 'string' && (eventTypes = eventType.split(' ')).length > 1) {
                var eventTypesLength = eventTypes.length;
                for (var i = 0; i < eventTypesLength; i++) {
                    this.on(eventTypes[i], listener);
                }
                return this;
            }
        }
        var listeners = this.getListeners(eventType, true);
        listeners.push(listener);
        return this;
    };

    EventEmitter.prototype.off = function() {
        var eventType, listener, i;
        if (typeof arguments[0] === 'object') {
            var map = arguments[0];
            for (eventType in map) {
                if (map.hasOwnProperty(eventType)) {
                    this.off(eventType, map[eventType]);
                }
            }
            return this;
        } else {
            eventType = arguments[0];
            listener = arguments[1];
            var eventTypes;
            if (typeof eventType === 'string' && (eventTypes = eventType.split(' ')).length > 1) {
                var eventTypesLength = eventTypes.length;
                for (i = 0; i < eventTypesLength; i++) {
                    this.off(eventTypes[i], listener);
                }
                return this;
            }
        }
        if (!eventType) {
            this.listeners.length = 0;
            return this;
        }
        var listeners = this.getListeners(eventType);
        if (!listeners) { return this; }
        if (!listener) {
            listeners.length = 0;
            return this;
        }
        var length = listeners.length;
        for (i = 0; i < length; i++) {
            if (listeners[i] === listener) {
                listeners.splice(i, 1);
                i--;
                length--;
            }
        }
        return this;
    };

    EventEmitter.prototype.emit = function(eventType) {
        var evnt;
        var listeners;
        if (eventType instanceof Event) {
            evnt = eventType;
            listeners = this.getListeners(evnt.type);
            if (!listeners) { return this; }
            evnt.source = this.source;
        } else {
            listeners = this.getListeners(eventType);
            if (!listeners) { return this; }
            evnt = new Event(eventType, arguments.length > 1 ?
                Array.prototype.slice.call(arguments, 1) : null, this.source);
        }
        var length = listeners.length;
        for (var i = 0; i < length; i++) {
            try {
                listeners[i].apply(evnt.source, evnt.args);
            } catch (error) {
                if (evnt.type === 'error' || !this.getListeners('listenererror')) {
                    /* global console */
                    if (typeof console !== 'undefined' && typeof console.error === 'function') {
                        console.error('Event listener ' + error.stack);
                    }
                } else {
                    this.emit('listenererror', {
                        originalEvent: evnt,
                        error: error,
                        listener: listeners[i]
                    });
                }
            }
        }
        return this;
    };

    EventEmitter.prototype.propertyChanged = function(property, value, previousValue) {
        var eventType = property.name + 'changed';
        if (this.getListeners(eventType)) {
            this.emit(eventType, {
                property: property,
                previousValue: previousValue,
                value: value
            });
        }
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
                    error.async = async;
                    async.failed(error);
                }
            }, timeout);
        }
    };

    Async.prototype.complete = function(err, result) {
        if (this.isComplete) { return; }
        this.isComplete = true;
        if (this.listeners) {
            var length = this.listeners.length;
            for (var i = 0; i < length; i++) {
                this.listeners[i](err, result);
            }
        }
        if (typeof this.callback !== 'function') { return; }
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
            if (typeof definition.getValue === 'function') {
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
                    pipeRun(err, result, options.continueOnError);
                };
                var self = this;
                var pipeRun = function pipeRun(lastError, lastResult, continueOnError) {
                    while (index < length && (!lastError || continueOnError)) {
                        try {
                            var value = values[index];
                            lastResult = value.apply(self, [lastError, lastResult]);
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
                            if (!continueOnError && !asyncEnd) {
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
            } else if (typeof source.traits === 'object') {
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
                if (!definition) {
                    continue;
                }
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

            if (options.singleAncestor && ancestorCount > 1) {
                errorMessage = 'multiple ancestor definitions where found' +
                    ' (single was expected). member: "' + memberName + '"';
                if (typeof source.name === 'string') {
                    errorMessage += ', at: "' + source.name + '"';
                }
                errorMessage += ', sources: ';
                for (i = 0; i < sequence.sources.length; i++) {
                    var ancestorSource = sequence.sources[i];
                    if (typeof ancestorSource.name === 'string')  {
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
            if (typeof wrapped !== 'function') {
                errorMessage = 'wrap must return a function. member: "' + memberName + '"';
                if (typeof source.name === 'string') {
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

    member.From.prototype.getValue = function(memberName) {
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

    member.AliasOf.prototype.getValue = function() {
        return this.baseTrait.getMember(this.memberName);
    };

    member.aliasOf = function(baseTrait, memberName){
        return new member.AliasOf(baseTrait, memberName);
    };

    member.Property = function Property(options) {
        this.options = typeof options === 'function' ? { getter: options } : options;
    };

    member.Property.prototype.isReadOnly = function() {
        return !!(this.options && this.options.getter && !this.options.setter);
    };

    member.Property.prototype.getValue = function(memberName){
        this.name = memberName;
        if (!this.storageName) {
            this.storageName = (this.options && this.options.storageName) || conventions.storageNamePrefix + memberName;
        }
        var property = this;
        var accessor = function(value) {
            if (typeof value === 'undefined') {
                var returnValue;
                if (property.options && property.options.getter) {
                    returnValue = property.options.getter.call(this);
                } else {
                    returnValue = this[property.storageName];
                }
                if (typeof returnValue === 'undefined' && property.options &&
                    typeof property.options.defaultValue !== 'undefined') {
                    returnValue = property.options.defaultValue;
                }
                return returnValue;
            } else {
                if (property.options && property.options.getter) {
                    if (property.options && property.options.setter) {
                        property.options.setter.call(this, value);
                    } else {
                        var error = new Error('property is readonly: "' + property.name + '"');
                        error.propertyIsReadonly = property;
                        error.source = this;
                        throw error;
                    }
                    return property.options.getter.call(this);
                } else {
                    var previousValue = this[property.storageName];
                    if (previousValue !== value) {
                        this[property.storageName] = value;
                        if (this._eventEmitter) {
                            this._eventEmitter.propertyChanged(property, value, previousValue);
                        }
                    }
                    return value;
                }
            }
        };
        accessor.property = this;
        return accessor;
    };

    member.property = function(options) {
        return new member.Property(options);
    };

    var createNamedFunction = function(name) {
        // eval is evil, but is the only way to create a named function programmatically
        var evilEval = eval;
        return evilEval('(function ' + name + '(){})');
    };

    var removeAllProperties = function(obj, removeMeta) {
        var keys = [];
        for (var name in obj) {
            if (obj.hasOwnProperty(name) && (removeMeta || name !== conventions.metaPropertyName)) {
                keys.push(name);
            }
        }
        for (var i = keys.length - 1; i >= 0; i--) {
            delete obj[keys[i]];
        }
    };

    var Meta = phenotype.Meta = function Meta(subject) {
        this.traits = [];
        this.definition = null;

        this.subject = subject || {};
        this.subject[conventions.metaPropertyName] = this;
        this.sourceOf = {};
        this.originalNameOf = {};
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
        if (typeof currentValue === 'undefined' || currentValue instanceof member.Required) {
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
                    meta.sourceOf[name] = meta.ownerTrait || meta.definition;
                }
                target[name].add(source, value);
            }
        }
    };

    var copyMetaMembers = function(meta, from) {
        var source, members, override;
        if (from instanceof Trait) {
            // copying from Trait
            var fromMeta = from.meta();
            source = function(name) {
                return fromMeta.sourceOf[name];
            };
            members = fromMeta.subject;
            override = false;
        } else {
            // copying from definition
            members = from;
            source = meta.ownerTrait || from;
            override = true;
        }
        for (var name in members) {
            if (members.hasOwnProperty(name) && name !== conventions.metaPropertyName) {
                var memberValue = members[name];
                var memberSource = typeof source === 'function' ? source(name) : source;
                setMetaMember(meta, name, memberValue, memberSource, override);
            }
        }
    };

    var metaResolveMember = function(meta, name, options) {
        var subject = meta.subject;
        if (subject.hasOwnProperty(name)) {
            var subjectMember = subject[name];
            var err;
            var source = meta.sourceOf[name];
            if (subjectMember instanceof member.Required) {
                if (options.ignoreRequired) {
                    return;
                }
                err = new Error(subjectMember.getMessage(name, source));
                err.required = subjectMember;
                err.requiredMember = name;
                err.requiredBy = meta.sourceOf[name];
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

    Meta.forTrait = function(trait) {
        var meta = new Meta();
        meta.ownerTrait = trait;
        meta.traits = trait.traits || [];
        meta.definition = trait.definition || null;
        buildMetaSubject(meta);
        return meta;
    };

    Meta.forObject = function(traits, definition) {
        /*
        if (traits && traits.length === 1 && !definition) {
            // if simple of child of single trait, reuse Meta (object won't be extensible)
            return traits[0].meta();
        }
        */
        var meta = new Meta();
        meta.traits = traits || [];
        meta.definition = definition || null;
        buildMetaSubject(meta);
        return meta;
    };

    Meta.prototype.refresh = function() {
        removeAllProperties(this.subject);
        buildMetaSubject(this);
        return this;
    };

    phenotype.refresh = function() {
        var argumentsLength = arguments.length;
        for (var i = 0; i < argumentsLength; i++) {
            var subject = arguments[i];
            var meta = Meta.of(subject);
            if (meta && meta.frozen) { meta.refresh().resolve(); }
        }
    };

    Meta.prototype.has = function(trait) {
        if (this.traits) {
            var traitsLength = this.traits.length;
            for (var i = 0; i < traitsLength; i++) {
                var metaTrait = this.traits[i];
                if (metaTrait === trait || metaTrait.has(trait)) {
                    return true;
                }
            }
        }
        return false;
    };

    var buildMetaSubject = function(meta) {
        var traits = meta.traits;
        if (traits && traits.length) {
            var traitsLength = traits.length;
            for (var i = 0; i < traitsLength; i++) {
                copyMetaMembers(meta, traits[i]);
            }
        }
        if (meta.definition) {
            copyMetaMembers(meta, meta.definition);
        }
    };

    Meta.prototype.resolve = function(options) {
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
            if (this.subject.hasOwnProperty(name)) {
                metaResolveMember(this, name, options || {});
            }
        }
        return this;
    };

    Meta.prototype.add = function() {
        if (this.ownerTrait) {
            throw new Error('This object has no extensible prototype' +
                ', modify parent Trait instead: ' + this.ownerTrait.name);
        }
        var argumentsLength = arguments.length;
        for (var i = 0; i < argumentsLength; i++) {
            var argument = arguments[i];
            if (typeof argument === 'object') {
                if (argument instanceof Trait) {
                    var alreadyExists = false;
                    for (var j = this.traits.length - 1; j >= 0; j--) {
                        if (this.traits[j] === argument) {
                            alreadyExists = true;
                            break;
                        }
                    }
                    if (!alreadyExists) {
                        this.traits.push(argument);
                    }
                } else {
                    if (!this.definition) {
                        this.definition = argument;
                    } else {
                        extend(this.definition, argument);
                    }
                }
            } else {
                throw new Error('Unexpected argument at index ' + i + ', type: ' + typeof argument);
            }
        }
        return this.refresh().resolve();
    };

    Meta.prototype.remove = function() {
        if (this.ownerTrait) {
            throw new Error('This object has no extensible prototype' +
                ', modify parent Trait instead: ' + this.ownerTrait.name);
        }
        var argumentsLength = arguments.length;
        for (var i = 0; i < argumentsLength; i++) {
            var argument = arguments[i];
            if (typeof argument !== 'object') {
                throw new Error('Unexpected argument at index ' + i + ', type: ' + typeof argument);
            }
            if (argument instanceof Trait) {
                for (var j = this.traits.length - 1; j >= 0; j--) {
                    if (this.traits[j] === argument) {
                        this.traits.splice(j, 1);
                        j++;
                    }
                }
            } else if (this.definition) {
                for (var name in argument) {
                    if (argument.hasOwnProperty(name)) {
                        if (typeof this.definition[name] === 'undefined') {
                            continue;
                        }
                        delete this.definition[name];
                    }
                }
            }
        }
        return this.refresh().resolve();
    };

    var anonymousTraits = 0;

    var Trait = phenotype.Trait = function Trait() {
        this.traits = [];
        for (var i = arguments.length - 1; i >= 0; i--) {
            var argument = arguments[i];
            if (typeof argument === 'object') {
                if (argument instanceof Trait) {
                    this.traits.unshift(argument);
                } else {
                    if (this.definition) {
                        throw new Error('multiple definition objects are not supported');
                    }
                    this.definition = argument;
                }
            } else {
                if (typeof argument === 'string' && i === 0) {
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

    Trait.prototype.addTo = function(target) {
        if (target instanceof Trait) {
            target.add(this);
        } else if (typeof target === 'object') {
            if (target instanceof Meta) {
                target.add(this);
            } else {
                var meta = Meta.of(target);
                if (!meta) {
                    this.mixin(target);
                } else {
                    meta.add(this);
                }
            }
        } else {
            throw new Error('cannot add a Trait to this object');
        }
        return this;
    };

    Trait.prototype.removeFrom = function(target) {
        if (target instanceof Trait) {
            target.remove(this);
        } else if (typeof target === 'object') {
            if (target instanceof Meta) {
                target.remove(this);
            } else {
                var meta = Meta.of(target);
                if (!meta) {
                    throw new Error('cannot remove Traits from this object');
                } else {
                    meta.remove(this);
                }
            }
        } else {
            throw new Error('cannot remove Traits from this object');
        }
        return this;
    };

    Trait.prototype.has = function(trait) {
        if (this.traits) {
            var traitsLength = this.traits.length;
            for (var i = 0; i < traitsLength; i++) {
                var parentTrait = this.traits[i];
                if (parentTrait === trait || parentTrait.has(trait)) {
                    return true;
                }
            }
        }
        return false;
    };

    Trait.prototype.add = function() {
        var argumentsLength = arguments.length;
        for (var i = 0; i < argumentsLength; i++) {
            var argument = arguments[i];
            if (typeof argument === 'object') {
                if (argument instanceof Trait) {
                    var alreadyExists = false;
                    for (var j = this.traits.length - 1; j >= 0; j--) {
                        if (this.traits[j] === argument) {
                            alreadyExists = true;
                            break;
                        }
                    }
                    if (!alreadyExists) {
                        this.traits.push(argument);
                    }
                } else {
                    if (!this.definition) {
                        this.definition = argument;
                    } else {
                        extend(this.definition, argument);
                    }
                }
            } else {
                throw new Error('Unexpected argument at index ' + i + ', type: ' + typeof argument);
            }
        }
        return this;
    };

    Trait.prototype.remove = function() {
        var argumentsLength = arguments.length;
        for (var i = 0; i < argumentsLength; i++) {
            var argument = arguments[i];
            if (typeof argument !== 'object') {
                throw new Error('Unexpected argument at index ' + i + ', type: ' + typeof argument);
            }
            if (argument instanceof Trait) {
                for (var j = this.traits.length - 1; j >= 0; j--) {
                    if (this.traits[j] === argument) {
                        this.traits.splice(j, 1);
                        j++;
                    }
                }
            } else if (this.definition) {
                for (var name in argument) {
                    if (argument.hasOwnProperty(name)) {
                        if (typeof this.definition[name] !== 'undefined') {
                            delete this.definition[name];
                        }
                    }
                }
            }
        }
        return this;
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

    Trait.prototype.freeze = function() {
        var meta = this.meta().resolve();
        meta.frozen = true;
        this.frozen = createNamedFunction(this.name);
        this.frozen.prototype = meta.subject;
        return this;
    };

    Trait.prototype.unfreeze = function() {
        this.frozen = null;
        return this;
    };

    Trait.prototype.mixin = function(target) {
        var source;
        if (this.frozen) {
            source = this.frozen.prototype;
        } else {
            source = this.meta().resolve({ ignoreRequired: true }).subject;
        }
        extend(target, source, {
            memberCopy: function(target, source, name) {
                var sourceValue = source[name];
                if (sourceValue instanceof member.Required) {
                    if (typeof target[name] === 'undefined') {
                        var requireSource = Meta.of(source).sourceOf[name];
                        var error = new Error(sourceValue.getMessage(name, requireSource));
                        error.required = sourceValue;
                        error.requiredMember = name;
                        error.requiredBy = requireSource;
                        throw error;
                    }
                } else {
                    target[name] = sourceValue;
                }
            }
        });
    };

    var createProxy = function(traits, definition) {

        // resolve now to test prototype is valid
        var meta = Meta.forObject(traits, definition).resolve();

        var getProto = function() {
            return meta.refresh().resolve().subject;
        };

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
                // As long as getProto() is not frozen, the proxy won't allow itself to be frozen
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
                getProto()[name] = val;
                return true;
            }, // bad behavior when set fails in non-strict mode
            enumerate: function() {
                var result = [];
                /* jshint forin:false */
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
            if (typeof argument === 'object') {
                if (argument instanceof Trait) {
                    traits.unshift(argument);
                } else {
                    if (definition) {
                        throw new Error('multiple definition objects are not supported');
                    }
                    definition = argument;
                }
            } else if (typeof argument !== 'undefined') {
                throw new Error('Unexpected argument at index ' + i + ', type: ' + typeof argument);
            }
        }

        var ConstructorFunction;
        var traitsLength = traits.length;
        if ((!definition) && traitsLength === 1 && traits[0].frozen) {
            ConstructorFunction = traits[0].frozen;
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
            if (!phenotype.dynamic) {
                // Proxy is not supported, use a frozen prototype
                var meta = Meta.forObject(traits, definition).resolve();
                meta.frozen = true;
                proto = meta.subject;
            } else {
                proto = createProxy(traits, definition);
            }
            ConstructorFunction = createNamedFunction(typeName);
            ConstructorFunction.prototype = proto;
        }

        return new ConstructorFunction();
    };

    EventEmitter.proxy = {
        forward: function(target, functionName, args) {
            var emitter = target._eventEmitter || (target._eventEmitter = new EventEmitter(target));
            return emitter[functionName].apply(emitter, args);
        },
        members: {
            on: function(){
                EventEmitter.proxy.forward(this, 'on', arguments);
                return this;
            },
            off: function(){
                EventEmitter.proxy.forward(this, 'off', arguments);
                return this;
            },
            emit: function(){
                EventEmitter.proxy.forward(this, 'emit', arguments);
                return this;
            }
        }
    };

    phenotype.HasEvents = new Trait('HasEvents', EventEmitter.proxy.members);

};
/* global exports */
if (typeof require === 'undefined') {
    moduleFactory(window.phenotype = {});
} else if (typeof exports === 'undefined') {
    /* global define */
    define('phenotype', ['exports'], moduleFactory);
} else {
    moduleFactory(exports);
}
