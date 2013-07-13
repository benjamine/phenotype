/* global require, describe, it */
var expect = expect || require('expect.js');
var phenotype = phenotype || require('../phenotype');

describe('Static functions', function(){
    'use strict';
    describe('phenotype', function(){
        describe('.version', function(){
            it('is the library semver version', function(){
                expect(phenotype.version).to.be.match(/^\d+\.\d+\.\d+$/);
            });
        });
        describe('.extend', function(){
            it('copies properties from object to object', function(){
                var source = {
                    a: 1,
                    b: {},
                    c: function() {},
                    d: [5, 7, true]
                };
                var target = {
                    b: false,
                    d: 'a',
                    k: 43
                };
                phenotype.extend(target, source);
                expect(target).to.be.eql({
                    a: 1,
                    b: {},
                    c: source.c,
                    d: [5, 7, true],
                    k: 43
                });
            });
            it('works recursively', function(){
                var source = {
                    a: 1,
                    b: {
                        b1: 5,
                        b2: {
                            b21: 7,
                            b22: 'z'
                        }
                    },
                    d: [5, 7, true]
                };
                var target = {
                    b: {
                        b2: {
                            b21: 5,
                            b23: 9
                        }
                    }
                };
                phenotype.extend(target, source, { recursive: true });
                expect(target).to.be.eql({
                    a: 1,
                    b: {
                        b1: 5,
                        b2: {
                            b21: 7,
                            b22: 'z',
                            b23: 9
                        }
                    },
                    d: [5, 7, true]
                });
            });
        });
        describe('.noop', function(){
            it('is a function that does nothing', function(){
                expect(phenotype.noop).to.be.a(Function);
                expect(phenotype.noop.toString()).to.be('function noop(){}');
            });
        });
        describe('.pending', function(){
            it('function that throws a "pending" error on execution', function(){
                expect(phenotype.pending).to.be.a(Function);
                expect(phenotype.pending).to.throwException(function(e){
                    expect(e.pending).to.be(true);
                });
            });
            it('thrown error informs method name', function(){
                var incomplete = {
                    doSomething: phenotype.pending,
                    doSomethingElse: function(){
                        phenotype.pending();
                    }
                };
                expect(function(){
                    incomplete.doSomething();
                }).to.throwException(function(e){
                    expect(e.pending).to.be(true);
                    expect(e.methodName).to.be('doSomething');
                });
                expect(function(){
                    incomplete.doSomethingElse();
                }).to.throwException(function(e){
                    expect(e.pending).to.be(true);
                    expect(e.methodName).to.be('doSomethingElse');
                });
            });
            it('or it can have a custom message', function(){
                var incomplete = {
                    doSomething: phenotype.pending.message('I\'m lazy'),
                    doSomethingElse: function(){
                        phenotype.pending('do this and that');
                    }
                };
                expect(function(){
                    incomplete.doSomething();
                }).to.throwException(function(e){
                    expect(e.pending).to.be(true);
                    expect(e.methodName).to.be('doSomething');
                    expect(e.message).to.be('I\'m lazy');
                });
                expect(function(){
                    incomplete.doSomethingElse();
                }).to.throwException(function(e){
                    expect(e.pending).to.be(true);
                    expect(e.methodName).to.be('doSomethingElse');
                    expect(e.message).to.be('do this and that');
                });
            });
        });
    });
});